import { afterEach, describe, expect, test } from 'bun:test';

import type { PublicAvatarModeration } from '@scs/schemas';

import {
  cancelPendingAvatarReviews,
  createAvatarReview,
  getAvatarReview,
  listAvatarAudit,
  listPendingAvatarReviewsForUser,
} from '@/repositories/public-avatar.repo';
import {
  ACCESS_LEVEL,
  APP_ROLE,
  setUserPermission,
} from '@/repositories/permissions.repo';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';
import { createTestSessionCookie } from 'test/helpers/create-test-session';
import { invokeWorker } from 'test/helpers/invoke-worker';

const ALLOWED_ORIGIN = 'https://portal.scs-pdn.space';
const ADMIN_EMAIL = 'admin@pdn.ac.lk';
const MEMBER_EMAIL = 'student@pdn.ac.lk';
const USERNAME = 'student';
const HASH = 'a'.repeat(64);

interface MemoryObject {
  body: Uint8Array;
  etag: string;
}

function createMemoryBucket(): R2Bucket & {
  objects: Map<string, MemoryObject>;
} {
  const objects = new Map<string, MemoryObject>();
  let revision = 0;

  function objectResponse(key: string) {
    const object = objects.get(key);
    if (!object) return null;
    return {
      etag: object.etag,
      httpEtag: `"${object.etag}"`,
      body: new Blob([object.body.slice().buffer]).stream(),
      json: async () => JSON.parse(new TextDecoder().decode(object.body)),
      arrayBuffer: async () => object.body.slice().buffer,
    };
  }

  return {
    objects,
    get: async (key: string) => objectResponse(key),
    head: async (key: string) => {
      const object = objects.get(key);
      return object
        ? { etag: object.etag, httpEtag: `"${object.etag}"` }
        : null;
    },
    put: async (
      key: string,
      value: string | Uint8Array | ArrayBuffer,
      options?: R2PutOptions
    ) => {
      const current = objects.get(key);
      const onlyIf = options?.onlyIf;
      if (onlyIf && 'etagMatches' in onlyIf) {
        if (!current || current.etag !== onlyIf.etagMatches) return null;
      }
      if (
        onlyIf &&
        'etagDoesNotMatch' in onlyIf &&
        onlyIf.etagDoesNotMatch === '*' &&
        current
      )
        return null;

      const bytes =
        typeof value === 'string'
          ? new TextEncoder().encode(value)
          : value instanceof Uint8Array
            ? value
            : new Uint8Array(value);
      revision += 1;
      objects.set(key, { body: bytes, etag: `etag-${revision}` });
      return objectResponse(key);
    },
    delete: async (key: string) => {
      objects.delete(key);
    },
  } as unknown as R2Bucket & { objects: Map<string, MemoryObject> };
}

const PENDING_HASH = 'b'.repeat(64);

const MODERATION: PublicAvatarModeration = {
  status: 'review_required',
  code: 'review_required',
  message: 'Image needs manual review',
  checks: [
    { id: 'safety', status: 'needs_review' },
    { id: 'portrait', status: 'passed' },
  ],
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngBytes(fill: number): Uint8Array {
  return new Uint8Array([
    ...PNG_SIGNATURE,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    fill,
    fill,
    fill,
    fill,
  ]);
}

function createImagesBinding(): ImagesBinding {
  let revision = 0;
  function output() {
    revision += 1;
    const bytes = new Uint8Array([revision, revision, revision]);
    return Promise.resolve({
      response: () =>
        new Response(bytes, { headers: { 'Content-Type': 'image/jpeg' } }),
    });
  }
  return {
    info: async () => ({
      format: 'image/png',
      width: 512,
      height: 512,
      fileSize: 20,
    }),
    input: () => ({ transform: () => ({ output }) }),
  } as unknown as ImagesBinding;
}

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

function stubReviewModerationFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (url.includes('/people/v2/users/'))
      return Response.json({ email: MEMBER_EMAIL });
    if (url.startsWith('https://api.typesafe.ai/'))
      return Response.json({
        answers: {
          safety: answer('uncertain', [
            'safe',
            'sexual',
            'violence',
            'hate',
            'gesture',
            'uncertain',
          ]),
          suitability: answer('portrait', [
            'portrait',
            'blurry',
            'obscured',
            'non_portrait',
            'meme_logo',
            'multiple',
            'uncertain',
          ]),
        },
      });
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
}

async function uploadAvatar(
  env: Env,
  cookie: string,
  bytes: Uint8Array
): Promise<Response> {
  const form = new FormData();
  form.append(
    'image',
    new File([bytes.slice().buffer], 'avatar.png', { type: 'image/png' })
  );
  return invokeWorker(
    '/api/people/v2/avatars/me',
    {
      method: 'POST',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'X-Client-Id': 'portal',
        Cookie: cookie,
      },
      body: form,
    },
    env
  );
}

function stubMemberProfileFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (url.includes('/people/v2/users/'))
      return Response.json({ email: MEMBER_EMAIL });
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
}

async function createMemberEnv(): Promise<{
  env: Env;
  bucket: ReturnType<typeof createMemoryBucket>;
  cookie: string;
}> {
  const bucket = createMemoryBucket();
  const env = createTestEnv({
    PROFILE_PICTURES: bucket,
    IMAGES: createImagesBinding(),
  });
  await setUserPermission(
    MEMBER_EMAIL,
    {
      role: APP_ROLE.STUDENT,
      accessLevel: ACCESS_LEVEL.NONE,
      name: 'Student',
    },
    env
  );
  return {
    env,
    bucket,
    cookie: await createTestSessionCookie(env, MEMBER_EMAIL),
  };
}

async function seedPendingReview(
  env: Env,
  bucket: ReturnType<typeof createMemoryBucket>,
  sha256 = PENDING_HASH,
  submittedAt = Date.now() - 1
): Promise<{ id: string; key: string }> {
  const key = `avatars/${USERNAME}/${sha256}.webp`;
  await bucket.put(key, new Uint8Array([4, 5, 6]));
  const id = crypto.randomUUID();
  await createAvatarReview(env, {
    id,
    username: USERNAME,
    sha256,
    objectKey: key,
    size: 3,
    moderation: MODERATION,
    submittedAt,
  });
  return { id, key };
}

async function createAdminEnv(): Promise<{
  env: Env;
  bucket: ReturnType<typeof createMemoryBucket>;
}> {
  const bucket = createMemoryBucket();
  const env = createTestEnv({ PROFILE_PICTURES: bucket });
  await setUserPermission(
    ADMIN_EMAIL,
    {
      role: APP_ROLE.USER,
      accessLevel: ACCESS_LEVEL.SUPER_ADMIN,
      name: 'Administrator',
    },
    env
  );
  return { env, bucket };
}

async function adminCookie(env: Env): Promise<string> {
  return createTestSessionCookie(env, ADMIN_EMAIL);
}

async function seedCurrentAvatar(
  env: Env,
  bucket: ReturnType<typeof createMemoryBucket>
): Promise<string> {
  const key = `avatars/${USERNAME}/${HASH}.webp`;
  await bucket.put(key, new Uint8Array([1, 2, 3]));
  await bucket.put(
    `avatars/${USERNAME}/current.json`,
    JSON.stringify({
      version: 1,
      key,
      sha256: HASH,
      contentType: 'image/webp',
      size: 3,
      updatedAt: '2026-11-06T00:00:00.000Z',
    })
  );
  return key;
}

describe('admin public avatar controls', () => {
  test('records who removed a member public picture', async () => {
    const { env, bucket } = await createAdminEnv();
    await seedCurrentAvatar(env, bucket);
    const cookie = await adminCookie(env);

    const response = await invokeWorker(
      `/api/admin/users/${encodeURIComponent(MEMBER_EMAIL)}/avatar`,
      {
        method: 'DELETE',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'Policy violation' }),
      },
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deleted: true });

    const pointer = JSON.parse(
      new TextDecoder().decode(
        bucket.objects.get(`avatars/${USERNAME}/current.json`)!.body
      )
    ) as { key: string | null };
    expect(pointer.key).toBeNull();

    const audit = await listAvatarAudit(env, USERNAME);
    expect(audit[0]).toMatchObject({
      action: 'admin_delete',
      actorEmail: ADMIN_EMAIL,
      actorKind: 'admin',
      note: 'Policy violation',
      previousSha256: HASH,
    });
  });

  test('requires a super administrator for avatar administration', async () => {
    const { env, bucket } = await createAdminEnv();
    await seedCurrentAvatar(env, bucket);
    await setUserPermission(
      MEMBER_EMAIL,
      { role: APP_ROLE.STUDENT, accessLevel: ACCESS_LEVEL.NONE },
      env
    );
    const cookie = await createTestSessionCookie(env, MEMBER_EMAIL);

    const response = await invokeWorker(
      `/api/admin/users/${encodeURIComponent(MEMBER_EMAIL)}/avatar`,
      {
        method: 'GET',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
        },
      },
      env
    );

    expect(response.status).toBe(403);
  });

  test('reports and resets a member hourly upload count', async () => {
    const { env, bucket } = await createAdminEnv();
    await seedCurrentAvatar(env, bucket);
    const windowStartedAt = Math.floor(Date.now() / 3_600_000) * 3_600_000;
    await env.AUTH_DB.prepare(
      `INSERT INTO public_avatar_rate (user_id, window_start, attempts) VALUES (?, ?, ?)`
    )
      .bind(USERNAME, windowStartedAt, 4)
      .run();
    const cookie = await adminCookie(env);
    const headers = {
      Origin: ALLOWED_ORIGIN,
      'X-Client-Id': 'portal',
      Cookie: cookie,
    };

    const before = await invokeWorker(
      `/api/admin/users/${encodeURIComponent(MEMBER_EMAIL)}/avatar`,
      { headers },
      env
    );
    expect(before.status).toBe(200);
    expect(await before.json()).toMatchObject({
      quota: { limit: 6, used: 4, remaining: 2, available: true },
    });

    const reset = await invokeWorker(
      '/api/admin/avatar-rate/reset',
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERNAME }),
      },
      env
    );
    expect(reset.status).toBe(200);
    expect(await reset.json()).toMatchObject({
      quota: { limit: 6, used: 0, remaining: 6, available: true },
    });

    const after = await invokeWorker(
      `/api/admin/users/${encodeURIComponent(MEMBER_EMAIL)}/avatar`,
      { headers },
      env
    );
    expect(await after.json()).toMatchObject({
      quota: { used: 0, remaining: 6 },
    });
  });

  test('requires a super administrator to reset upload counts', async () => {
    const { env } = await createAdminEnv();
    await setUserPermission(
      MEMBER_EMAIL,
      { role: APP_ROLE.STUDENT, accessLevel: ACCESS_LEVEL.NONE },
      env
    );
    const cookie = await createTestSessionCookie(env, MEMBER_EMAIL);

    const response = await invokeWorker(
      '/api/admin/avatar-rate/reset',
      {
        method: 'POST',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: USERNAME }),
      },
      env
    );

    expect(response.status).toBe(403);
  });

  test('approves a review and records the administrator who allowed it', async () => {
    const { env, bucket } = await createAdminEnv();
    const key = `avatars/${USERNAME}/${HASH}.webp`;
    await bucket.put(key, new Uint8Array([4, 5, 6]));
    const reviewId = crypto.randomUUID();
    await createAvatarReview(env, {
      id: reviewId,
      username: USERNAME,
      sha256: HASH,
      objectKey: key,
      size: 3,
      moderation: MODERATION,
      submittedAt: Date.now(),
    });
    const cookie = await adminCookie(env);

    const response = await invokeWorker(
      `/api/admin/avatar-reviews/${reviewId}`,
      {
        method: 'POST',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'approve' }),
      },
      env
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      review: { status: string; reviewedBy: string | null };
      url: string | null;
    };
    expect(body.review).toMatchObject({
      status: 'approved',
      reviewedBy: ADMIN_EMAIL,
    });
    expect(body.url).toContain(
      `/api/people/v2/avatars/${USERNAME}/${HASH}.webp`
    );

    const pointer = JSON.parse(
      new TextDecoder().decode(
        bucket.objects.get(`avatars/${USERNAME}/current.json`)!.body
      )
    ) as { key: string };
    expect(pointer.key).toBe(key);

    const stored = await getAvatarReview(env, reviewId);
    expect(stored).toMatchObject({
      status: 'approved',
      reviewedBy: ADMIN_EMAIL,
    });
    const audit = await listAvatarAudit(env, USERNAME);
    expect(audit[0]).toMatchObject({
      action: 'review_approved',
      actorEmail: ADMIN_EMAIL,
      actorKind: 'admin',
      sha256: HASH,
      reviewId,
    });
  });

  test('approving a review supersedes only older pending reviews', async () => {
    const { env, bucket } = await createAdminEnv();
    const key = `avatars/${USERNAME}/${HASH}.webp`;
    await bucket.put(key, new Uint8Array([10, 11, 12]));
    const olderId = crypto.randomUUID();
    const newerId = crypto.randomUUID();
    await createAvatarReview(env, {
      id: olderId,
      username: USERNAME,
      sha256: HASH,
      objectKey: key,
      size: 3,
      moderation: MODERATION,
      submittedAt: Date.now() - 1000,
    });
    await createAvatarReview(env, {
      id: newerId,
      username: USERNAME,
      sha256: HASH,
      objectKey: key,
      size: 3,
      moderation: MODERATION,
      submittedAt: Date.now(),
    });
    const cookie = await adminCookie(env);

    const response = await invokeWorker(
      `/api/admin/avatar-reviews/${newerId}`,
      {
        method: 'POST',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'approve' }),
      },
      env
    );

    expect(response.status).toBe(200);
    expect(await getAvatarReview(env, newerId)).toMatchObject({
      status: 'approved',
    });
    expect(await getAvatarReview(env, olderId)).toMatchObject({
      status: 'rejected',
      reviewedBy: ADMIN_EMAIL,
    });
  });

  test('cancels only pending reviews submitted before the cutoff', async () => {
    const { env, bucket } = await createAdminEnv();
    const key = `avatars/${USERNAME}/${HASH}.webp`;
    await bucket.put(key, new Uint8Array([13, 14, 15]));
    const olderId = crypto.randomUUID();
    const newerId = crypto.randomUUID();
    await createAvatarReview(env, {
      id: olderId,
      username: USERNAME,
      sha256: HASH,
      objectKey: key,
      size: 3,
      moderation: MODERATION,
      submittedAt: 1_000,
    });
    await createAvatarReview(env, {
      id: newerId,
      username: USERNAME,
      sha256: HASH,
      objectKey: key,
      size: 3,
      moderation: MODERATION,
      submittedAt: 3_000,
    });

    const cancelled = await cancelPendingAvatarReviews(env, {
      username: USERNAME,
      reviewedBy: ADMIN_EMAIL,
      reviewedAt: 4_000,
      note: 'Superseded by a newer approved picture.',
      submittedBefore: 2_000,
    });

    expect(cancelled.map((review) => review.id)).toEqual([olderId]);
    expect(await getAvatarReview(env, olderId)).toMatchObject({
      status: 'rejected',
    });
    expect(await getAvatarReview(env, newerId)).toMatchObject({
      status: 'pending',
    });
  });

  test('cancels every older pending review without a page limit', async () => {
    const { env } = await createAdminEnv();
    const key = `avatars/${USERNAME}/${HASH}.webp`;
    const ids: string[] = [];
    for (let index = 0; index < 60; index += 1) {
      const id = crypto.randomUUID();
      ids.push(id);
      await createAvatarReview(env, {
        id,
        username: USERNAME,
        sha256: HASH,
        objectKey: key,
        size: 3,
        moderation: MODERATION,
        submittedAt: index + 1,
      });
    }

    const cancelled = await cancelPendingAvatarReviews(env, {
      username: USERNAME,
      reviewedBy: ADMIN_EMAIL,
      reviewedAt: 1_000,
      note: 'Superseded by a newer picture.',
      submittedBefore: 1_000,
    });

    expect(cancelled).toHaveLength(60);
    expect(new Set(cancelled.map((review) => review.id))).toEqual(new Set(ids));
  });

  test('keeps a review pending when its stored picture is missing', async () => {
    const { env } = await createAdminEnv();
    const reviewId = crypto.randomUUID();
    await createAvatarReview(env, {
      id: reviewId,
      username: USERNAME,
      sha256: HASH,
      objectKey: `avatars/${USERNAME}/${HASH}.webp`,
      size: 3,
      moderation: MODERATION,
      submittedAt: Date.now(),
    });
    const cookie = await adminCookie(env);

    const response = await invokeWorker(
      `/api/admin/avatar-reviews/${reviewId}`,
      {
        method: 'POST',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'approve' }),
      },
      env
    );

    expect(response.status).toBe(502);
    expect(await getAvatarReview(env, reviewId)).toMatchObject({
      status: 'pending',
      reviewedBy: null,
    });
  });

  test('queues a review-required upload and supersedes the older candidate', async () => {
    const bucket = createMemoryBucket();
    const env = createTestEnv({
      PROFILE_PICTURES: bucket,
      IMAGES: createImagesBinding(),
    });
    await setUserPermission(
      MEMBER_EMAIL,
      { role: APP_ROLE.STUDENT, accessLevel: ACCESS_LEVEL.NONE },
      env
    );
    const cookie = await createTestSessionCookie(env, MEMBER_EMAIL);
    stubReviewModerationFetch();

    const first = await uploadAvatar(env, cookie, pngBytes(1));
    expect(first.status).toBe(503);
    expect(await first.json()).toMatchObject({
      code: 'avatar_moderation_review_required',
    });
    const [firstReview] = await listPendingAvatarReviewsForUser(env, USERNAME);
    expect(firstReview).toBeDefined();

    const second = await uploadAvatar(env, cookie, pngBytes(2));
    expect(second.status).toBe(503);
    const pending = await listPendingAvatarReviewsForUser(env, USERNAME);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).not.toBe(firstReview!.id);
    expect(await getAvatarReview(env, firstReview!.id)).toMatchObject({
      status: 'rejected',
      reviewedBy: MEMBER_EMAIL,
    });
    expect(bucket.objects.has(firstReview!.objectKey)).toBe(false);
    expect(bucket.objects.has(pending[0].objectKey)).toBe(true);
  });

  test('rejects a review without publishing the picture', async () => {
    const { env, bucket } = await createAdminEnv();
    const key = `avatars/${USERNAME}/${HASH}.webp`;
    await bucket.put(key, new Uint8Array([7, 8, 9]));
    const reviewId = crypto.randomUUID();
    await createAvatarReview(env, {
      id: reviewId,
      username: USERNAME,
      sha256: HASH,
      objectKey: key,
      size: 3,
      moderation: MODERATION,
      submittedAt: Date.now(),
    });
    const cookie = await adminCookie(env);

    const response = await invokeWorker(
      `/api/admin/avatar-reviews/${reviewId}`,
      {
        method: 'POST',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reject', note: 'Not a portrait' }),
      },
      env
    );

    expect(response.status).toBe(200);
    expect(bucket.objects.has(`avatars/${USERNAME}/current.json`)).toBe(false);
    expect(bucket.objects.has(key)).toBe(false);
    const stored = await getAvatarReview(env, reviewId);
    expect(stored).toMatchObject({
      status: 'rejected',
      reviewedBy: ADMIN_EMAIL,
      note: 'Not a portrait',
    });
    const audit = await listAvatarAudit(env, USERNAME);
    expect(audit[0]).toMatchObject({
      action: 'review_rejected',
      actorEmail: ADMIN_EMAIL,
      note: 'Not a portrait',
    });
  });
});

describe('owner public avatar review visibility', () => {
  test('returns the pending candidate beside the published picture', async () => {
    const { env, bucket, cookie } = await createMemberEnv();
    await seedCurrentAvatar(env, bucket);
    const review = await seedPendingReview(env, bucket);
    stubMemberProfileFetch();

    const response = await invokeWorker(
      '/api/people/v2/avatars/me',
      {
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
        },
      },
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      username: USERNAME,
      url: expect.stringContaining(`/${USERNAME}/${HASH}.webp`),
      pending: {
        id: review.id,
        sha256: PENDING_HASH,
        size: 3,
        moderation: MODERATION,
      },
    });
  });

  test('serves the pending image only to its owner and only while pending', async () => {
    const { env, bucket, cookie } = await createMemberEnv();
    const review = await seedPendingReview(env, bucket);
    stubMemberProfileFetch();

    const response = await invokeWorker(
      `/api/people/v2/avatars/me/pending?id=${review.id}`,
      {
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
        },
      },
      env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([4, 5, 6])
    );

    const missing = await invokeWorker(
      `/api/people/v2/avatars/me/pending?id=${crypto.randomUUID()}`,
      {
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
        },
      },
      env
    );
    expect(missing.status).toBe(404);
  });

  test('withdraws the pending candidate without removing the published picture', async () => {
    const { env, bucket, cookie } = await createMemberEnv();
    await seedCurrentAvatar(env, bucket);
    const review = await seedPendingReview(env, bucket);
    stubMemberProfileFetch();

    const response = await invokeWorker(
      '/api/people/v2/avatars/me/pending',
      {
        method: 'DELETE',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
        },
      },
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deleted: true });

    const pointer = JSON.parse(
      new TextDecoder().decode(
        bucket.objects.get(`avatars/${USERNAME}/current.json`)!.body
      )
    ) as { key: string | null; sha256: string | null };
    expect(pointer).toMatchObject({
      key: `avatars/${USERNAME}/${HASH}.webp`,
      sha256: HASH,
    });
    expect(bucket.objects.has(review.key)).toBe(false);
    expect(await getAvatarReview(env, review.id)).toMatchObject({
      status: 'rejected',
      reviewedBy: MEMBER_EMAIL,
      note: 'Withdrawn by the profile owner.',
    });
    expect((await listAvatarAudit(env, USERNAME))[0]).toMatchObject({
      action: 'review_rejected',
      actorKind: 'owner',
      actorEmail: MEMBER_EMAIL,
      note: 'Withdrawn by the profile owner.',
    });

    const current = await invokeWorker(
      '/api/people/v2/avatars/me',
      {
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
        },
      },
      env
    );
    expect(await current.json()).toMatchObject({
      url: expect.stringContaining(`/${USERNAME}/${HASH}.webp`),
      pending: null,
    });
  });

  test('reports no withdrawal when nothing is pending', async () => {
    const { env, cookie } = await createMemberEnv();
    stubMemberProfileFetch();

    const response = await invokeWorker(
      '/api/people/v2/avatars/me/pending',
      {
        method: 'DELETE',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-Client-Id': 'portal',
          Cookie: cookie,
        },
      },
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deleted: false });
  });
});
