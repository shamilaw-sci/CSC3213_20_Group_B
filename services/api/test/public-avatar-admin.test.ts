import { describe, expect, test } from 'bun:test';

import type { PublicAvatarModeration } from '@scs/schemas';

import {
  cancelPendingAvatarReviews,
  createAvatarReview,
  getAvatarReview,
  listAvatarAudit,
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

const MODERATION: PublicAvatarModeration = {
  status: 'review_required',
  code: 'review_required',
  message: 'Image needs manual review',
  checks: [
    { id: 'safety', status: 'needs_review' },
    { id: 'portrait', status: 'passed' },
  ],
};

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
