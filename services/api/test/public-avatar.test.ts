import { describe, expect, test } from 'bun:test';

import {
  animated,
  avatarQuota,
  formatFromMagic,
  getPublicAvatar,
  moderate,
  moderationDecision,
} from '@/services/public-avatar.service';
import type { Env } from '@/types/env';

function answer(value: string, options: string[]) {
  return {
    type: 'choice',
    choice: value,
    confidence: 0.9,
    probabilities: Object.fromEntries(
      options.map((option) => [option, option === value ? 0.95 : 0.01])
    ),
  };
}

const safety = ['safe', 'sexual', 'violence', 'hate', 'gesture', 'uncertain'];
const suitability = [
  'portrait',
  'blurry',
  'obscured',
  'non_portrait',
  'meme_logo',
  'multiple',
  'uncertain',
];

function result(safetyValue: string, suitabilityValue: string) {
  return moderationDecision({
    answers: {
      safety: answer(safetyValue, safety),
      suitability: answer(suitabilityValue, suitability),
    },
  });
}

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

  test('approves safe professional and casual portraits on the same visible criteria', () => {
    expect(result('safe', 'portrait')).toMatchObject({
      status: 'approved',
      code: 'approved',
      checks: [
        { id: 'safety', status: 'passed' },
        { id: 'portrait', status: 'passed' },
      ],
    });
  });

  test.each(['sexual', 'violence', 'hate', 'gesture'])(
    'rejects %s safety class',
    (kind) => {
      expect(result(kind, 'portrait')).toMatchObject({
        status: 'rejected',
        code: 'unsafe_content',
        checks: [
          { id: 'safety', status: 'failed' },
          { id: 'portrait', status: 'passed' },
        ],
      });
    }
  );

  test.each(['blurry', 'obscured', 'non_portrait', 'meme_logo', 'multiple'])(
    'rejects %s suitability class',
    (kind) => {
      expect(result('safe', kind)).toMatchObject({
        status: 'rejected',
        code: 'unsuitable_portrait',
        checks: [
          { id: 'safety', status: 'passed' },
          { id: 'portrait', status: 'failed' },
        ],
      });
    }
  );

  test('holds uncertain and low-confidence responses for review', () => {
    expect(result('uncertain', 'portrait')).toMatchObject({
      status: 'review_required',
      code: 'review_required',
      checks: [
        { id: 'safety', status: 'needs_review' },
        { id: 'portrait', status: 'passed' },
      ],
    });
    expect(
      moderationDecision({
        answers: {
          safety: { ...answer('safe', safety), confidence: 0.1 },
          suitability: answer('portrait', suitability),
        },
      })
    ).toMatchObject({
      status: 'review_required',
      checks: [
        { id: 'safety', status: 'needs_review' },
        { id: 'portrait', status: 'passed' },
      ],
    });
  });

  test('distinguishes malformed moderation responses from policy rejection', () => {
    expect(moderationDecision({ answers: {} })).toMatchObject({
      status: 'unavailable',
      code: 'moderation_invalid_response',
      checks: [
        { id: 'safety', status: 'not_checked' },
        { id: 'portrait', status: 'not_checked' },
      ],
    });
  });

  test('sends real JPEG bytes with the experimental image header', async () => {
    let sent = false;
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const fetcher = async (_url: string, init: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('TypeSafe-Danger-Zone-Images')).toBe('true');
      expect(headers.get('Authorization')).toBe('Bearer test-key');
      const part = (init?.body as FormData).get('photo') as File;
      expect(new Uint8Array(await part.arrayBuffer())).toEqual(jpeg);
      sent = true;
      return Response.json({
        answers: {
          safety: answer('safe', safety),
          suitability: answer('portrait', suitability),
        },
      });
    };
    expect(
      await moderate(jpeg, { TYPESAFE_API_KEY: 'test-key' } as Env, fetcher)
    ).toMatchObject({ status: 'approved', code: 'approved' });
    expect(sent).toBe(true);
  });

  test('reports timeouts, HTTP errors, and missing credentials as unavailable', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const env = { TYPESAFE_API_KEY: 'test-key' } as Env;
    expect(
      await moderate(jpeg, env, async () => {
        throw new Error('timeout');
      })
    ).toMatchObject({
      status: 'unavailable',
      code: 'moderation_unavailable',
    });
    expect(
      await moderate(jpeg, env, async () => new Response(null, { status: 401 }))
    ).toMatchObject({
      status: 'unavailable',
      code: 'moderation_unavailable',
    });
    expect(await moderate(jpeg, { TYPESAFE_API_KEY: '' } as Env)).toMatchObject(
      {
        status: 'unavailable',
        code: 'moderation_unavailable',
      }
    );
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
  });
});
