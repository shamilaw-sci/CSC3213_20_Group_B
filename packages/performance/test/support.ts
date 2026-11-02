import environments from '@config/environments.json';
import fixtures from '@fixtures/synthetic.json';

import { buildPlan } from '@/config/plan';
import { fixtureSessions } from '@/config/runtime';
import { environmentSchema, fixturesSchema } from '@/config/schema';

export const revision = 'a'.repeat(40);
export function input(settings: unknown = {}) {
  return {
    environment: 'local',
    target: environmentSchema.parse(environments.local),
    profile: 'smoke' as const,
    settings,
    fixtures: fixturesSchema.parse(fixtures),
    sessions: fixtureSessions(2),
    revision,
    sourceRevision: revision,
  };
}
export function plan(settings: unknown = {}) {
  return buildPlan(input(settings));
}
