import { loadPlan } from '@/config/runtime';
import { startFixture } from '@/fixture-server';
import { runK6 } from '@/runner';

const fixture = startFixture();
try {
  const { plan, sessions } = await loadPlan({
    environment: 'local',
    profile: 'smoke',
    localCheck: true,
  });
  const { report, directory } = await runK6(plan, sessions);
  process.stdout.write(
    `${report.verdict}: ${directory}; fixture received ${fixture.requestCount()} requests. No application capacity measured.\n`
  );
  if (report.verdict !== 'PASS' || fixture.requestCount() > plan.requestBudget)
    process.exitCode = 1;
} finally {
  fixture.server.stop(true);
}
