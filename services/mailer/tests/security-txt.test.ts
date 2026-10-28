import { beforeAll, describe, expect, test } from 'bun:test';
import type { Hono } from 'hono';

let app: Hono;

beforeAll(async () => {
  process.env.MAILER_API_KEY = 'test-mailer-api-key';
  app = (await import('@/app')).default;
});

describe('Mailer security.txt redirect', () => {
  test('redirects discovery paths case-insensitively for GET and HEAD', async () => {
    for (const [method, path] of [
      ['GET', '/security.txt'],
      ['HEAD', '/SECURITY.TXT'],
      ['GET', '/.Well-Known/Security.Txt'],
    ]) {
      const response = await app.request(`${path}?from=mailer`, { method });

      expect(response.status).toBe(308);
      expect(response.headers.get('location')).toBe(
        'https://portal.scs-pdn.space/.well-known/security.txt'
      );
    }
  });

  test('leaves unsupported methods on the existing fallback', async () => {
    const response = await app.request('/security.txt', { method: 'POST' });

    expect(response.status).toBe(404);
  });
});
