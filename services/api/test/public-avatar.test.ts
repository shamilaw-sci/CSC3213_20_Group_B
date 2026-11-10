import { describe, expect, test } from 'bun:test';

import {
  animated,
  avatarQuota,
  formatFromMagic,
  getPublicAvatar,
} from '@/services/public-avatar.service';
import type { Env } from '@/types/env';

describe('public avatar validation', () => {
  test('recognizes only upload magic bytes', () => {
    expect(
      formatFromMagic(new Uint8Array([0xff, 0xd8, 0xff, ...Array(9).fill(0)]))
    ).toBe('image/jpeg');
    expect(
      formatFromMagic(
        new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
        ])
      )
    ).toBe('image/png');
    expect(
      formatFromMagic(new TextEncoder().encode('<svg onload="alert(1)"/>'))
    ).toBeNull();
  });

  test('rejects PNG animation chunks', () => {
    const bytes = new Uint8Array(20);
    bytes.set(new TextEncoder().encode('acTL'), 12);
    expect(animated(bytes, 'image/png')).toBe(true);
  });

  test('reports fixed hourly quota windows without consuming attempts', () => {
    const now = Date.UTC(2026, 10, 6, 12, 34, 56, 789);
    const empty = avatarQuota(0, now);
    expect(empty).toMatchObject({
      limit: 6,
      used: 0,
      remaining: 6,
      available: true,
      windowStartedAt: '2026-11-06T12:00:00.000Z',
      resetsAt: '2026-11-06T13:00:00.000Z',
    });
    expect(empty.retryAfterSeconds).toBe(1504);

    expect(avatarQuota(2, now)).toMatchObject({
      used: 2,
      remaining: 4,
      available: true,
    });
    expect(avatarQuota(6, now)).toMatchObject({
      used: 6,
      remaining: 0,
      available: false,
    });
    expect(avatarQuota(9, now)).toMatchObject({
      used: 6,
      remaining: 0,
      available: false,
    });
  });

  test('serves only the current approved hash and revokes reads after deletion', async () => {
    const hash = 'a'.repeat(64);
    let pointer: {
      version: number;
      key: string | null;
      sha256: string | null;
      contentType: string;
      size: number;
      updatedAt: string;
    } = {
      version: 1,
      key: `avatars/alice/${hash}.webp`,
      sha256: hash,
      contentType: 'image/webp',
      size: 3,
      updatedAt: '2026-11-04T00:00:00.000Z',
    };
    const bucket = {
      get: async (key: string) =>
        key.endsWith('current.json')
          ? {
              etag: 'pointer',
              json: async () => pointer,
              body: new Blob(['{}']).stream(),
            }
          : {
              etag: 'image',
              httpEtag: '"image"',
              body: new Blob([new Uint8Array([1, 2, 3])]).stream(),
            },
      head: async () => ({ etag: 'image', httpEtag: '"image"' }),
    } as unknown as R2Bucket;
    const env = { PROFILE_PICTURES: bucket } as Env;
    const base = 'https://api.scs-pdn.space/api/people/v2/avatars/alice';
    const current = await getPublicAvatar(new Request(base), env);
    expect(current.status).toBe(302);
    expect(current.headers.get('location')).toBe(`${base}/${hash}.webp`);
    const image = await getPublicAvatar(
      new Request(`${base}/${hash}.webp`),
      env
    );
    expect(image.status).toBe(200);
    expect(image.headers.get('cache-control')).toBe('no-store');
    expect(image.headers.get('content-type')).toBe('image/webp');
    expect(await image.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer);
    expect(
      (
        await getPublicAvatar(
          new Request(`${base}/${'b'.repeat(64)}.webp`),
          env
        )
      ).status
    ).toBe(404);
    pointer = { ...pointer, key: null, sha256: null };
    expect(
      (await getPublicAvatar(new Request(`${base}/${hash}.webp`), env)).status
    ).toBe(404);
    pointer = { ...pointer, size: Number.NaN };
    await expect(getPublicAvatar(new Request(base), env)).rejects.toThrow(
      'Invalid avatar pointer'
    );
  });
});
