import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { chromium, type Request as BrowserRequest } from 'playwright';

import { resultsRoot, runtime } from '@/config/runtime';
import type { Plan, Session } from '@/config/schema';
import { MetricsCollector } from '@/reporters/metrics';
import { createReport, writeReport } from '@/reporters/report';
import { acquireRunLock, initialState, startResourceMonitor } from '@/runner';

export function allowedBrowserRequest(plan: Plan, url: string, method: string) {
  if (method !== 'GET' && method !== 'OPTIONS') return false;
  const parsed = new URL(url);
  if (!Object.values(plan.target.origins).includes(parsed.origin)) return false;
  if (
    parsed.pathname === '/logout' ||
    parsed.pathname.includes('/proxy') ||
    (parsed.pathname.includes('/pr') && parsed.pathname.startsWith('/api/'))
  )
    return false;
  if (parsed.pathname.startsWith('/api/'))
    return ['/api/me', '/api/auth/get-session'].includes(parsed.pathname);
  return true;
}

export async function runBrowser(plan: Plan, sessions: Session[]) {
  if (plan.profile !== 'smoke' || plan.vus > 5 || plan.seconds > 120)
    throw new Error(
      'Browser probes are limited to the smoke profile, five planned VUs, and two minutes; execution is serial.'
    );
  const release = await acquireRunLock();
  const directory = resolve(resultsRoot, plan.runId);
  const state = initialState('playwright');
  const collector = new MetricsCollector(plan);
  const steps: { name: string; durationMs: number; passed: boolean }[] = [];
  let blocked = 0;
  let budget = 0;
  let lastRequestAt = 0;
  const epoch = Date.now();
  const emit = (
    metric: string,
    value: number,
    tags: Record<string, string> = {}
  ) =>
    collector.consume({
      type: 'Point',
      metric,
      data: { time: new Date().toISOString(), value, tags },
    });
  emit('perf_epoch', epoch);
  const stopMonitor = startResourceMonitor(state);
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const pending = new Set<Promise<void>>();
  let marker: ReturnType<typeof setInterval> | undefined;
  const closeBrowser = () => {
    void browser?.close().catch(() => {});
  };
  const interrupt = () => {
    state.reason = 'Browser probe cancelled';
    closeBrowser();
  };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    await mkdir(directory, { recursive: true });
    browser = await chromium.launch({
      executablePath: runtime.PERF_BROWSER_EXECUTABLE,
    });
    deadline = setTimeout(() => {
      state.reason = 'Browser wall-clock deadline exceeded';
      closeBrowser();
    }, plan.seconds * 1000);
    marker = setInterval(() => {
      if (existsSync(resolve(directory, 'CANCEL'))) interrupt();
    }, 250);
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.routeWebSocket('**/*', (socket) => {
      blocked++;
      emit('perf_guardrail', 1);
      void socket.close().catch(() => {});
    });
    const starts = new WeakMap<BrowserRequest, number>();
    if (sessions[0]) {
      const split = sessions[0].cookie.indexOf('=');
      for (const origin of new Set([
        plan.target.origins.api!,
        plan.target.origins.portal!,
      ])) {
        await context.addCookies([
          {
            name: sessions[0].cookie.slice(0, split),
            value: sessions[0].cookie.slice(split + 1),
            url: origin,
            httpOnly: true,
            secure: origin.startsWith('https:'),
          },
        ]);
      }
    }
    await context.route('**/*', async (route) => {
      const req = route.request();
      if (
        !allowedBrowserRequest(plan, req.url(), req.method()) ||
        budget >= Math.min(plan.requestBudget, 500)
      ) {
        blocked++;
        emit('perf_guardrail', 1);
        await route.abort();
        return;
      }
      budget++;
      // A reservation serializes starts without delaying unrelated response handling.
      const next = Math.max(
        Date.now(),
        lastRequestAt + 1000 / Math.min(10, plan.maxRps)
      );
      lastRequestAt = next;
      await Bun.sleep(Math.max(0, next - Date.now()));
      if (state.reason) {
        await route.abort();
        return;
      }
      starts.set(req, performance.now());
      emit('perf_attempted', 1);
      /*
       * Playwright can follow redirect hops without invoking route handlers again.
       * Fetch one hop so a redirect cannot escape the allowlist or request budget.
       */
      try {
        const response = await route.fetch({
          maxRedirects: 0,
          maxRetries: 0,
          timeout: plan.settings.timeoutSeconds * 1000,
        });
        if (response.status() >= 300 && response.status() < 400) {
          blocked++;
          emit('perf_guardrail', 1);
          await route.abort();
        } else await route.fulfill({ response });
      } catch {
        await route.abort().catch(() => {});
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    context.on('requestfailed', (req) => {
      const start = starts.get(req);
      if (start === undefined) return;
      const tags = {
        endpoint: 'browser_resource',
        classification: 'connection',
      };
      emit('perf_latency', performance.now() - start, tags);
      emit('perf_failure', 1, tags);
    });
    context.on('requestfinished', (req) => {
      const task = (async () => {
        const response = await req.response();
        if (!response) return;
        const status = response.status();
        const ok = status >= 200 && status < 400;
        const tags = {
          endpoint: 'browser_resource',
          classification: ok ? 'ok' : status >= 500 ? 'http_5xx' : 'http_4xx',
        };
        emit('perf_completed', 1, tags);
        if (ok) emit('perf_successful', 1, tags);
        emit(
          'perf_latency',
          performance.now() - (starts.get(req) ?? performance.now()),
          tags
        );
        emit('perf_failure', ok ? 0 : 1, tags);
      })();
      pending.add(task);
      void task.finally(() => pending.delete(task)).catch(() => {});
    });
    const step = async (name: string, action: () => Promise<void>) => {
      emit('perf_iterations_started', 1);
      const start = performance.now();
      let passed = false;
      try {
        await action();
        passed = true;
      } finally {
        steps.push({ name, durationMs: performance.now() - start, passed });
        emit('perf_journeys_completed', 1);
        emit('perf_journey_success', passed ? 1 : 0);
      }
    };
    const navigate = async (origin: string, path: string) => {
      const response = await page.goto(origin + path, {
        waitUntil: 'domcontentloaded',
      });
      if (!response?.ok()) throw new Error('Navigation failed');
      await page.getByRole('heading', { level: 1 }).first().waitFor();
    };
    await step('web_home', () => navigate(plan.target.origins.web!, '/'));
    await step('people_search', async () => {
      await navigate(plan.target.origins.people!, '/');
      await page
        .getByRole('searchbox', { name: 'Search people' })
        .fill(plan.fixtures.searchQueries[0]);
      const link = page
        .locator(`a[href="/people/${plan.fixtures.identities[0]}"]`)
        .first();
      await link.waitFor();
      await link.click();
      await page.waitForURL(`**/people/${plan.fixtures.identities[0]}`);
      await page.getByRole('heading', { level: 1 }).first().waitFor();
    });
    await step('projects_browse', async () => {
      await navigate(plan.target.origins.projects!, '/browse');
      await navigate(
        plan.target.origins.projects!,
        `/projects/${plan.fixtures.projectSlugs[0]}`
      );
    });
    if (sessions.length)
      await step('portal_profile', async () => {
        const loaded =
          plan.target.kind === 'fixture'
            ? undefined
            : page.waitForResponse(
                (res) =>
                  res.url() === `${plan.target.origins.api}/api/me` &&
                  res.status() === 200
              );
        await navigate(plan.target.origins.portal!, '/user/me');
        await loaded;
        await page
          .getByText(sessions[0].originalName, { exact: true })
          .first()
          .waitFor();
      });
    await Promise.allSettled(pending);
    state.exitCode = 0;
    if (blocked)
      state.reason =
        'Browser requests blocked by allowlist or budget; inspect isolated asset/dependency configuration';
  } catch {
    state.reason ??=
      'Browser journey failed; check synthetic fixtures, isolated origins, and installed Chromium';
  } finally {
    if (deadline) clearTimeout(deadline);
    if (marker) clearInterval(marker);
    await browser?.close().catch(() => {});
    await Promise.allSettled(pending);
    stopMonitor();
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    state.finishedAt = new Date().toISOString();
    await release();
  }
  const report = createReport(plan, collector, state);
  await writeReport(directory, report);
  await writeFile(
    resolve(directory, 'browser-steps.json'),
    JSON.stringify(
      {
        steps,
        blockedRequests: blocked,
        note: 'Action/navigation timings through a one-hop intercepted transport; HTTP cache is disabled. Network timings are not native browser resource timings. No screenshots, traces, credentials or response bodies are saved.',
      },
      null,
      2
    )
  );
  return { directory, report };
}
