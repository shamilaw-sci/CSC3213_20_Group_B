import { beforeAll, expect, test } from 'bun:test';
import type { Hono } from 'hono';

let app: Hono;

beforeAll(async () => {
  process.env.MAILER_API_KEY = 'test-mailer-api-key';
  app = (await import('@/app')).default;
});

test('Mailer exposes private liveness and readiness without a bearer token', async () => {
  expect((await app.request('/healthz')).status).toBe(200);
  expect((await app.request('/readyz')).status).toBe(200);
  expect((await app.request('/send')).status).toBe(401);
});
