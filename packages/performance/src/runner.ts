import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { cpus, freemem, totalmem } from 'node:os';
import { resolve } from 'node:path';

import {
  runStateSchema,
  savedPlanSchema,
  telemetrySchema,
} from '@/config/artifacts';
import { safetyLimits } from '@/config/limits';
import {
  childSystemEnvironment,
  packageRoot,
  resultsRoot,
  runtime,
} from '@/config/runtime';
import type { Plan, Session } from '@/config/schema';
import { collectFile, MetricsCollector } from '@/reporters/metrics';
import { createReport, type RunState, writeReport } from '@/reporters/report';

export async function syntheticRequest(
  plan: Plan,
  session: Session,
  method: 'GET' | 'PATCH',
  name?: string,
  timeoutMs = safetyLimits.controlRequestMs
) {
  const response = await fetch(`${plan.target.origins.api}/api/me`, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Cookie: session.cookie,
      Origin: plan.target.origins.portal!,
      'X-Client-Id': 'portal',
      'Content-Type': 'application/json',
      'X-Performance-Run': plan.runId,
    },
    body: name === undefined ? undefined : JSON.stringify({ name }),
  });
  if (response.status !== 200)
    throw new Error('Synthetic account operation failed.');
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== 'object' ||
    !('name' in value) ||
    typeof value.name !== 'string'
  )
    throw new Error('Invalid synthetic profile response.');
  if (
    method === 'GET' &&
    (!('email' in value) || value.email !== session.email)
  )
    throw new Error('Synthetic identity mismatch.');
  return value.name;
}

export function startResourceMonitor(state: RunState) {
  let previous = cpus();
  let last = performance.now();
  let busySamples = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    const current = cpus();
    let idle = 0;
    let total = 0;
    current.forEach((cpu, i) => {
      const old = previous[i];
      if (!old) return;
      idle += cpu.times.idle - old.times.idle;
      total +=
        Object.values(cpu.times).reduce((a, b) => a + b, 0) -
        Object.values(old.times).reduce((a, b) => a + b, 0);
    });
    const ratio = total ? 1 - idle / total : 0;
    const memory = freemem() / totalmem();
    const lag = Math.max(0, now - last - 1000);
    state.generator.samples++;
    state.generator.maxCpuRatio = Math.max(
      state.generator.maxCpuRatio ?? 0,
      ratio
    );
    state.generator.minFreeMemoryRatio = Math.min(
      state.generator.minFreeMemoryRatio ?? 1,
      memory
    );
    state.generator.maxTimerLagMs = Math.max(
      state.generator.maxTimerLagMs ?? 0,
      lag
    );
    busySamples = ratio > 0.9 ? busySamples + 1 : 0;
    if (busySamples >= 3 || memory < 0.1 || lag > 1000)
      state.generator.saturated = true;
    previous = current;
    last = now;
  }, 1000);
  return () => clearInterval(timer);
}

export function initialState(engine: RunState['engine'] = 'k6'): RunState {
  return {
    engine,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    exitCode: 1,
    reason: null,
    cleanup: 'not-needed',
    cleanupFailedIds: [],
    preparationRequests: 0,
    cleanupRequests: 0,
    generator: {
      samples: 0,
      maxCpuRatio: null,
      minFreeMemoryRatio: null,
      maxTimerLagMs: null,
      saturated: false,
    },
  };
}

export async function acquireRunLock() {
  const directory = resolve(packageRoot, '.cache');
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, 'run.lock');
  const handle = await open(path, 'wx').catch(() => {
    throw new Error(
      'Another performance run holds .cache/run.lock. After a crash, verify its PID has stopped before removing this file.'
    );
  });
  await handle.writeFile(String(process.pid));
  return async () => {
    await handle.close();
    await rm(path, { force: true });
  };
}

export async function runK6(plan: Plan, sessions: Session[]) {
  const release = await acquireRunLock();
  const directory = resolve(resultsRoot, plan.runId);
  const state = initialState();
  const prepared: Session[] = [];
  let cleanupRequired = false;
  let stopMonitor = () => {};
  let watchdog: ReturnType<typeof setInterval> | undefined;
  let child: ReturnType<typeof Bun.spawn> | undefined;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  let privateDirectory: string | undefined;
  let lastControlRequest = 0;
  let controlDeadline = Date.now() + safetyLimits.controlPhaseMs;
  let controlPhase: 'preparationRequests' | 'cleanupRequests' =
    'preparationRequests';
  const controlRequest = async (
    session: Session,
    method: 'GET' | 'PATCH',
    name?: string
  ) => {
    const next = Math.max(Date.now(), lastControlRequest + 1000 / plan.maxRps);
    if (next >= controlDeadline)
      throw new Error('Control phase deadline exceeded.');
    lastControlRequest = next;
    await Bun.sleep(Math.max(0, next - Date.now()));
    if (
      controlPhase === 'preparationRequests' &&
      (state.reason || existsSync(resolve(directory, 'CANCEL')))
    ) {
      state.reason ??= 'Cancelled by marker file';
      throw new Error('Cancelled');
    }
    const remaining = controlDeadline - Date.now();
    if (remaining <= 0) throw new Error('Control phase deadline exceeded.');
    state[controlPhase]++;
    return syntheticRequest(
      plan,
      session,
      method,
      name,
      Math.min(safetyLimits.controlRequestMs, remaining)
    );
  };
  const cancel = (reason: string) => {
    if (state.reason) return;
    state.reason = reason;
    child?.kill('SIGINT');
    killTimer = setTimeout(
      () => child?.kill('SIGKILL'),
      safetyLimits.killGraceMs
    );
  };
  const interrupt = () => cancel('Cancelled by operator');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, 'plan.json'),
      JSON.stringify(plan, null, 2)
    );
    privateDirectory = await mkdtemp(resolve(packageRoot, '.cache/sessions-'));
    const sessionsFile = resolve(privateDirectory, 'sessions.json');
    await writeFile(sessionsFile, JSON.stringify(sessions), { mode: 0o600 });
    const childEnv: Record<string, string> = {
      PERF_PLAN_FILE: resolve(directory, 'plan.json'),
      PERF_SESSIONS_FILE: sessionsFile,
      ...childSystemEnvironment,
      K6_NO_USAGE_REPORT: 'true',
    };
    const version = Bun.spawnSync([runtime.PERF_K6_BINARY, 'version'], {
      env: childEnv,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (version.exitCode !== 0 || !version.stdout.toString().includes('v2.3.0'))
      throw new Error('Install the documented k6 version (2.3.0).');
    // No credentials or response bodies are written to the run directory.
    if (plan.writes) {
      for (const session of sessions) {
        if (state.reason) throw new Error('Cancelled');
        if ((await controlRequest(session, 'GET')) !== session.originalName)
          throw new Error('Synthetic account not at its declared baseline.');
        prepared.push(session);
      }
    }
    if (existsSync(resolve(directory, 'CANCEL')))
      state.reason ??= 'Cancelled by marker file';
    if (state.reason) throw new Error('Cancelled');
    cleanupRequired = plan.writes;
    child = Bun.spawn(
      [
        runtime.PERF_K6_BINARY,
        'run',
        '--quiet',
        '--no-usage-report',
        '--address',
        '127.0.0.1:0',
        '--config',
        resolve(packageRoot, 'config/k6.json'),
        '--out',
        `json=${resolve(directory, 'metrics.ndjson')}`,
        resolve(packageRoot, 'k6/load.ts'),
      ],
      {
        cwd: packageRoot,
        env: childEnv,
        // k6 errors can contain request URLs. Reports use bounded error classes instead of raw logs.
        stdout: 'ignore',
        stderr: 'ignore',
      }
    );
    stopMonitor = startResourceMonitor(state);
    const deadline =
      Date.now() + plan.seconds * 1000 + safetyLimits.childGraceMs;
    watchdog = setInterval(() => {
      if (Date.now() >= deadline) cancel('Wall-clock deadline exceeded');
      if (existsSync(resolve(directory, 'CANCEL')))
        cancel('Cancelled by marker file');
    }, 250);
    state.exitCode = await child.exited;
  } catch {
    if (child) {
      child.kill('SIGKILL');
      await child.exited;
    }
    state.reason ??= child
      ? 'Execution failed'
      : 'Preflight failed; verify k6 installation, target, and synthetic account baseline';
    state.exitCode = 1;
  } finally {
    if (watchdog) clearInterval(watchdog);
    if (killTimer) clearTimeout(killTimer);
    stopMonitor();
    if (cleanupRequired) {
      controlPhase = 'cleanupRequests';
      controlDeadline = Date.now() + safetyLimits.controlPhaseMs;
      lastControlRequest = Date.now();
      state.cleanup = 'passed';
      // Bounded batches restore every captured baseline even after an interrupt or threshold failure.
      for (let i = 0; i < prepared.length; i += 5) {
        const results = await Promise.allSettled(
          prepared.slice(i, i + 5).map(async (session) => {
            const restored = await controlRequest(
              session,
              'PATCH',
              session.originalName
            );
            const verified = await controlRequest(session, 'GET');
            if (
              restored !== session.originalName ||
              verified !== session.originalName
            )
              throw new Error('Cleanup mismatch');
          })
        );
        results.forEach((r, j) => {
          if (r.status === 'rejected') {
            state.cleanup = 'failed';
            state.cleanupFailedIds.push(prepared[i + j].id);
          }
        });
      }
    }
    state.finishedAt = new Date().toISOString();
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    if (privateDirectory) {
      try {
        await rm(resolve(privateDirectory, 'sessions.json'), { force: true });
        await rmdir(privateDirectory);
      } catch {
        state.reason = 'Temporary credential cleanup failed';
      }
    }
    await release();
  }
  await writeFile(
    resolve(directory, 'state.json'),
    JSON.stringify(state, null, 2)
  );
  let collector: MetricsCollector;
  try {
    collector = await collectFile(resolve(directory, 'metrics.ndjson'), plan);
  } catch {
    collector = new MetricsCollector(plan);
  }
  const report = createReport(plan, collector, state);
  await writeReport(directory, report);
  return { directory, report };
}

export async function regenerateReport(
  directory: string,
  telemetryFile?: string
) {
  // Only our saved run artifacts are accepted here. No commands or target requests are executed.
  const plan = savedPlanSchema.parse(
    JSON.parse(
      await readFile(resolve(directory, 'plan.json'), 'utf8')
    ) as unknown
  );
  const state = runStateSchema.parse(
    JSON.parse(
      await readFile(resolve(directory, 'state.json'), 'utf8')
    ) as unknown
  );
  const report = createReport(
    plan,
    await collectFile(resolve(directory, 'metrics.ndjson'), plan),
    state
  );
  const savedTelemetry = resolve(directory, 'telemetry.json');
  if (telemetryFile || existsSync(savedTelemetry)) {
    const t = telemetrySchema.parse(
      JSON.parse(
        await readFile(telemetryFile ?? savedTelemetry, 'utf8')
      ) as unknown
    );
    if (
      t.runId !== plan.runId ||
      t.deploymentRevision !== plan.deploymentRevision ||
      Date.parse(t.windowStart) > Date.parse(state.startedAt) ||
      Date.parse(t.windowEnd) < Date.parse(state.finishedAt)
    )
      throw new Error(
        'Provider telemetry must match the run/revision and cover its full UTC window.'
      );
    report.providerTelemetry = t;
    const {
      runId: _runId,
      deploymentRevision: _revision,
      source: _source,
      windowStart: _start,
      windowEnd: _end,
      ...metrics
    } = t;
    report.infrastructure = metrics;
    await writeFile(savedTelemetry, JSON.stringify(t, null, 2));
  }
  await writeReport(directory, report);
  return report;
}
