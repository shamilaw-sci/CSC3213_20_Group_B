import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

import type { PublicAvatarModeration } from '@scs/schemas';

import { createPostgresAuthDatabase } from '@/config/postgres-auth-database';
import { createPostgresAvatarReviewRepository } from '@/repositories/public-avatar.postgres';
import {
  cancelPendingAvatarReviews,
  createAvatarReview,
  getAvatarReview,
  getPendingAvatarReviewForUser,
  hasPendingAvatarObject,
  listAvatarAudit,
  listPendingAvatarReviewPage,
  listPendingAvatarReviewsForUser,
  markAvatarReview,
  recordAvatarAudit,
  reopenAvatarReview,
} from '@/repositories/public-avatar.repo';
import type { Env } from '@/types/env';
import { createTestEnv } from 'test/helpers/create-test-env';

const MODERATION: PublicAvatarModeration = {
  status: 'review_required',
  code: 'review_required',
  message: 'Needs review',
  checks: [{ id: 'safety', status: 'needs_review' }],
};
const HASH = 'a'.repeat(64);

async function checkContract(first: Env, second: Env) {
  expect(await getAvatarReview(first, 'missing')).toBeNull();
  expect(await getPendingAvatarReviewForUser(first, 'alice')).toBeNull();
  expect(await listAvatarAudit(first, 'alice')).toEqual([]);
  for (const [id, submittedAt] of [
    ['r1', 1000],
    ['r2', 1000],
    ['r3', 2000],
  ] as const) {
    await createAvatarReview(first, {
      id,
      username: 'alice',
      sha256: HASH,
      objectKey: `pending/${id}.webp`,
      size: 42,
      moderation: MODERATION,
      submittedAt,
    });
  }
  expect((await getAvatarReview(second, 'r1'))?.moderation).toEqual(MODERATION);
  expect((await getPendingAvatarReviewForUser(second, 'alice'))?.id).toBe('r3');
  expect((await getPendingAvatarReviewForUser(second, 'alice', 'r1'))?.id).toBe(
    'r1'
  );
  expect(
    (
      await listPendingAvatarReviewsForUser(first, 'alice', {
        submittedBefore: 1000,
      })
    ).map((item) => item.id)
  ).toEqual(['r2', 'r1']);
  const page = await listPendingAvatarReviewPage(first, { limit: 1 });
  expect(page.items.map((item) => item.id)).toEqual(['r3']);
  expect(page.nextCursor).toEqual({ submittedAt: 2000, id: 'r3' });
  const next = await listPendingAvatarReviewPage(second, {
    limit: 1,
    cursor: page.nextCursor!,
  });
  expect(next.items.map((item) => item.id)).toEqual(['r2']);
  expect(await hasPendingAvatarObject(first, 'alice', HASH)).toBe(true);
  expect(
    await markAvatarReview(first, {
      id: 'r3',
      status: 'approved',
      reviewedBy: 'admin',
      reviewedAt: 3000,
    })
  ).toBe(true);
  expect(
    await markAvatarReview(second, {
      id: 'r3',
      status: 'rejected',
      reviewedBy: 'admin',
      reviewedAt: 3001,
    })
  ).toBe(false);
  await reopenAvatarReview(second, 'r3', 3001);
  expect((await getAvatarReview(first, 'r3'))?.status).toBe('approved');
  await reopenAvatarReview(second, 'r3', 3000);
  expect((await getAvatarReview(first, 'r3'))?.status).toBe('pending');
  const cancelled = await cancelPendingAvatarReviews(second, {
    username: 'alice',
    reviewedBy: 'admin',
    reviewedAt: 4000,
    note: 'superseded',
    submittedBefore: 2000,
  });
  expect(cancelled.map((item) => item.id).sort()).toEqual(['r1', 'r2']);
  expect(
    await cancelPendingAvatarReviews(first, {
      username: 'alice',
      reviewedBy: 'admin',
      reviewedAt: 4001,
      note: 'again',
      submittedBefore: 2000,
    })
  ).toEqual([]);
  await recordAvatarAudit(first, {
    username: 'alice',
    actorEmail: 'alice@example.com',
    actorKind: 'owner',
    action: 'review_submitted',
    previousSha256: null,
    sha256: HASH,
    reviewId: 'r3',
    note: null,
    createdAt: 5000,
  });
  const history = await listAvatarAudit(second, 'alice', 1);
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({
    action: 'review_submitted',
    createdAt: 5000,
    sha256: HASH,
  });
}

test('D1 avatar review and audit contract', async () => {
  const env = createTestEnv();
  await checkContract(env, env);
});

const postgresTest = process.env.POSTGRES_TEST_URL ? test : test.skip;

postgresTest(
  'PostgreSQL avatar review contract and concurrent claim',
  async () => {
    const connectionString = process.env.POSTGRES_TEST_URL!;
    const schema = `scs_avatar_${crypto.randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const firstPool = createPostgresAuthDatabase({
      connectionString,
      schema,
      maxConnections: 6,
    });
    const secondPool = createPostgresAuthDatabase({
      connectionString,
      schema,
      maxConnections: 6,
    });
    try {
      await firstPool.query(
        await readFile(
          new URL(
            '../migrations/postgres/0006_public_avatar_moderation.sql',
            import.meta.url
          ),
          'utf8'
        )
      );
      const base = createTestEnv();
      const first = {
        ...base,
        AVATAR_REVIEW_REPOSITORY:
          createPostgresAvatarReviewRepository(firstPool),
      };
      const second = {
        ...base,
        AVATAR_REVIEW_REPOSITORY:
          createPostgresAvatarReviewRepository(secondPool),
      };
      await checkContract(first, second);
      const claims = await Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          markAvatarReview(index % 2 ? first : second, {
            id: 'r3',
            status: index % 2 ? 'approved' : 'rejected',
            reviewedBy: `admin${index}`,
            reviewedAt: 6000 + index,
          })
        )
      );
      expect(claims.filter(Boolean)).toHaveLength(1);
      expect((await getAvatarReview(first, 'r3'))?.status).not.toBe('pending');
      await expect(
        firstPool.query(
          'INSERT INTO public_avatar_review (id, username, sha256, object_key, size, moderation_json, status, submitted_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)',
          ['bad', 'alice', HASH, 'x', 1, '{}', 'invalid', 0]
        )
      ).rejects.toThrow();
    } finally {
      await Promise.all([firstPool.end(), secondPool.end()]);
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    }
  }
);
