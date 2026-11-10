import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import sharp from 'sharp';

const integrationTest =
  process.env.POSTGRES_TEST_URL && process.env.S3_TEST_BUCKET
    ? test
    : test.skip;

test('Bun API rejects invalid startup configuration', async () => {
  const child = Bun.spawn(['bun', 'src/server.ts'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { ...process.env, POSTGRES_URL: 'invalid-database-url' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  expect(await child.exited).not.toBe(0);
  const stderr =
    child.stderr instanceof ReadableStream
      ? await new Response(child.stderr).text()
      : '';
  expect(stderr).toContain('POSTGRES_URL');
}, 10_000);

async function signedCookie(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token))
  );
  return `scs-auth.session_token=${token}.${btoa(String.fromCharCode(...signature))}`;
}

integrationTest(
  'Bun API persists sessions and serves approved avatars after restart',
  async () => {
    const connectionString = process.env.POSTGRES_TEST_URL!;
    const schema = `phase6_api_${crypto.randomUUID().replaceAll('-', '')}`;
    const port = 17000 + Math.floor(Math.random() * 1000);
    const base = `http://127.0.0.1:${port}`;
    const githubPort = port + 2000;
    const githubBase = `http://127.0.0.1:${githubPort}`;
    const operationSchema = `${schema}_operations`;
    const queueSchema = `${schema}_jobs`;
    const admin = new Pool({ connectionString });
    const pool = new Pool({
      connectionString,
      options: `-c search_path=${schema}`,
    });
    const operationPool = new Pool({
      connectionString,
      options: `-c search_path=${operationSchema}`,
    });
    const userId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const authSecret = 'phase6-isolated-test-secret-with-32-characters';
    const username = `phase6${crypto.randomUUID().slice(0, 8)}`;
    const email = `${username}@sci.pdn.ac.lk`;
    const adminEmail = `admin${crypto.randomUUID().slice(0, 8)}@sci.pdn.ac.lk`;
    const adminToken = crypto.randomUUID();
    const hash = 'a'.repeat(64);
    const image = new Uint8Array([1, 2, 3, 255]);
    const { createS3Store } = await import('@scs/storage/s3');
    const storage = createS3Store({
      driver: 's3',
      bucket: process.env.S3_TEST_BUCKET!,
      region: process.env.S3_TEST_REGION!,
      endpoint: process.env.S3_TEST_ENDPOINT!,
      accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY!,
    });
    let child: ReturnType<typeof Bun.spawn> | undefined;
    let githubChild: ReturnType<typeof Bun.spawn> | undefined;
    const profileServer = Bun.serve({
      port: 0,
      fetch(request) {
        if (
          new URL(request.url).pathname === `/people/v2/users/${username}.json`
        )
          return Response.json({ email });
        return new Response(null, { status: 404 });
      },
    });
    const imageKeys = new Set([`avatars/${username}/${hash}.webp`]);
    const start = async (mode: 'approved' | 'review' = 'approved') => {
      child = Bun.spawn(
        ['bun', '--preload', 'test/helpers/mock-typesafe.ts', 'src/server.ts'],
        {
          cwd: fileURLToPath(new URL('../../', import.meta.url)),
          env: {
            ...process.env,
            POSTGRES_URL: connectionString,
            POSTGRES_SCHEMA: schema,
            API_PORT: String(port),
            BETTER_AUTH_URL: base,
            BETTER_AUTH_SECRET: authSecret,
            GOOGLE_CLIENT_ID: 'test',
            GOOGLE_CLIENT_SECRET: 'test',
            GITHUB_CLIENT_ID: 'test',
            GITHUB_CLIENT_SECRET: 'test',
            MAILER_API_URL: base,
            MAILER_API_KEY: 'test',
            GITHUB_APP_INTERNAL_SECRET: 'phase6-github-secret',
            GITHUB_APP_API_URL: githubBase,
            DATA_PUBLIC_BASE_URL: `http://127.0.0.1:${profileServer.port}`,
            WEB_PROXY_INTERNAL_SECRET: 'test',
            TYPESAFE_API_KEY: 'test',
            AVATAR_S3_BUCKET: process.env.S3_TEST_BUCKET!,
            PHASE6_MODERATION_MODE: mode,
            AVATAR_S3_REGION: process.env.S3_TEST_REGION!,
            AVATAR_S3_ENDPOINT: process.env.S3_TEST_ENDPOINT!,
            AVATAR_S3_ACCESS_KEY_ID: process.env.S3_TEST_ACCESS_KEY_ID!,
            AVATAR_S3_SECRET_ACCESS_KEY: process.env.S3_TEST_SECRET_ACCESS_KEY!,
          },
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) break;
        try {
          if ((await fetch(`${base}/readyz`)).status === 200) return;
        } catch {
          /* startup */
        }
        await Bun.sleep(100);
      }
      const stderr =
        child.stderr instanceof ReadableStream
          ? await new Response(child.stderr).text()
          : `exit ${child.exitCode}`;
      throw new Error(`API failed to start: ${stderr}`);
    };
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      for (const filename of [
        '0001_better_auth.sql',
        '0002_auth_identity_uniqueness.sql',
        '0003_public_avatar_rate.sql',
        '0004_proxy_settings.sql',
        '0005_permissions.sql',
        '0006_public_avatar_moderation.sql',
      ]) {
        await pool.query(
          await readFile(
            new URL(`../../migrations/postgres/${filename}`, import.meta.url),
            'utf8'
          )
        );
      }
      await admin.query(`CREATE SCHEMA "${operationSchema}"`);
      for (const filename of [
        '0001_operation_state.sql',
        '0002_operation_dispatch_outbox.sql',
      ]) {
        await operationPool.query(
          await readFile(
            new URL(
              `../../../github-app/migrations/postgres/${filename}`,
              import.meta.url
            ),
            'utf8'
          )
        );
      }
      githubChild = Bun.spawn(['bun', 'src/server.ts'], {
        cwd: fileURLToPath(new URL('../../../github-app/', import.meta.url)),
        env: {
          ...process.env,
          POSTGRES_URL: connectionString,
          POSTGRES_SCHEMA: operationSchema,
          PGBOSS_SCHEMA: queueSchema,
          PORT: String(githubPort),
          GITHUB_APP_ID: '1',
          GITHUB_PRIVATE_KEY: 'test-key',
          GITHUB_INSTALLATION_ID: '1',
          GITHUB_OWNER: 'test-owner',
          GITHUB_PEOPLE_DATA_REPOSITORY: 'data',
          GITHUB_PROJECTS_DATA_REPOSITORY: 'data',
          X_INTERNAL_SECRET: 'phase6-github-secret',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });
      let githubReady = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (githubChild.exitCode !== null) break;
        try {
          githubReady = (await fetch(`${githubBase}/readyz`)).status === 200;
        } catch {
          /* startup */
        }
        if (githubReady) break;
        await Bun.sleep(100);
      }
      if (!githubReady) throw new Error('GitHub App failed to start');
      await pool.query(
        'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)',
        [userId, 'Phase Six', email]
      );
      await pool.query(
        'INSERT INTO "session" (id, token, "userId", "expiresAt", "updatedAt") VALUES ($1, $2, $3, $4, $5)',
        [
          crypto.randomUUID(),
          token,
          userId,
          new Date(Date.now() + 3600_000),
          new Date(),
        ]
      );
      await pool.query(
        'INSERT INTO permission (email, "permissionJson", role, "accessLevel", name, picture, blacklisted) VALUES ($1, $2::jsonb, $3, $4, $5, $6, 0)',
        [
          email,
          JSON.stringify({
            role: 'STUDENT',
            accessLevel: 'NONE',
            name: 'Phase Six',
          }),
          'STUDENT',
          'NONE',
          'Phase Six',
          '',
        ]
      );
      const adminId = crypto.randomUUID();
      await pool.query(
        'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)',
        [adminId, 'Administrator', adminEmail]
      );
      await pool.query(
        'INSERT INTO "session" (id, token, "userId", "expiresAt", "updatedAt") VALUES ($1, $2, $3, $4, $5)',
        [
          crypto.randomUUID(),
          adminToken,
          adminId,
          new Date(Date.now() + 3600_000),
          new Date(),
        ]
      );
      await pool.query(
        'INSERT INTO permission (email, "permissionJson", role, "accessLevel", name, picture, blacklisted) VALUES ($1, $2::jsonb, $3, $4, $5, $6, 0)',
        [
          adminEmail,
          JSON.stringify({
            role: 'ACADEMIC',
            accessLevel: 'SUPER_ADMIN',
            name: 'Administrator',
          }),
          'ACADEMIC',
          'SUPER_ADMIN',
          'Administrator',
          '',
        ]
      );
      await storage.put(`avatars/${username}/${hash}.webp`, image, {
        metadata: { contentType: 'image/webp' },
      });
      await storage.put(
        `avatars/${username}/current.json`,
        JSON.stringify({
          version: 1,
          key: `avatars/${username}/${hash}.webp`,
          sha256: hash,
          contentType: 'image/webp',
          size: image.length,
          updatedAt: new Date().toISOString(),
        }),
        {
          condition: { kind: 'create' },
          metadata: { contentType: 'application/json' },
        }
      );
      await start();
      expect((await fetch(`${base}/healthz`)).status).toBe(200);
      expect((await fetch(`${base}/api/me`)).status).toBe(401);
      const headers = {
        Cookie: await signedCookie(token, authSecret),
        'X-Client-Id': 'portal',
      };
      const authSession = await fetch(`${base}/api/auth/get-session`, {
        headers,
      });
      expect(authSession.status).toBe(200);
      expect(await authSession.json()).toHaveProperty('user.email', email);
      const me = await fetch(`${base}/api/me`, { headers });
      expect(me.status).toBe(200);
      expect(await me.json()).toHaveProperty('email', email);
      expect(
        (
          await fetch(`${base}/api/operations/phase6missingoperation`, {
            headers,
          })
        ).status
      ).toBe(404);
      const redirect = await fetch(
        `${base}/api/people/v2/avatars/${username}`,
        { redirect: 'manual' }
      );
      expect(redirect.status).toBe(302);
      const publicImage = await fetch(
        `${base}/api/people/v2/avatars/${username}/${hash}.webp`
      );
      expect(publicImage.status).toBe(200);
      expect(new Uint8Array(await publicImage.arrayBuffer())).toEqual(image);
      const upload = async (color: string) => {
        const png = await sharp({
          create: { width: 320, height: 320, channels: 3, background: color },
        })
          .png()
          .toBuffer();
        const form = new FormData();
        form.set(
          'image',
          new File([png], 'portrait.png', { type: 'image/png' })
        );
        return fetch(`${base}/api/people/v2/avatars/me`, {
          method: 'POST',
          headers,
          body: form,
        });
      };
      const approved = await upload('#123456');
      expect(approved.status).toBe(200);
      const approvedJson = (await approved.json()) as { sha256: string };
      imageKeys.add(`avatars/${username}/${approvedJson.sha256}.webp`);
      const approvedImage = await fetch(
        `${base}/api/people/v2/avatars/${username}/${approvedJson.sha256}.webp`
      );
      expect(approvedImage.status).toBe(200);
      expect(
        (await sharp(await approvedImage.arrayBuffer()).metadata()).format
      ).toBe('webp');
      child!.kill('SIGTERM');
      expect(await child!.exited).toBe(process.platform === 'win32' ? 143 : 0);
      child = undefined;
      await start('review');
      expect((await fetch(`${base}/api/me`, { headers })).status).toBe(200);
      expect(
        (
          await fetch(
            `${base}/api/people/v2/avatars/${username}/${approvedJson.sha256}.webp`
          )
        ).status
      ).toBe(200);
      const reviewUpload = await upload('#654321');
      expect(reviewUpload.status).toBe(503);
      expect(await reviewUpload.json()).toHaveProperty(
        'code',
        'avatar_moderation_review_required'
      );
      const reviewRows = await pool.query<{
        id: string;
        sha256: string;
        object_key: string;
      }>(
        'SELECT id, sha256, object_key FROM public_avatar_review WHERE username = $1 AND status = $2',
        [username, 'pending']
      );
      expect(reviewRows.rowCount).toBe(1);
      const review = reviewRows.rows[0]!;
      imageKeys.add(review.object_key);
      expect(
        (
          await fetch(
            `${base}/api/people/v2/avatars/${username}/${review.sha256}.webp`
          )
        ).status
      ).toBe(404);
      expect(
        (await fetch(`${base}/api/people/v2/avatars/me/pending`, { headers }))
          .status
      ).toBe(200);
      expect(
        (
          await fetch(`${base}/api/admin/avatar-reviews/${review.id}/image`, {
            headers,
          })
        ).status
      ).toBe(403);
      const adminHeaders = {
        Cookie: await signedCookie(adminToken, authSecret),
        'X-Client-Id': 'portal',
      };
      expect(
        (
          await fetch(`${base}/api/admin/avatar-reviews/${review.id}/image`, {
            headers: adminHeaders,
          })
        ).status
      ).toBe(200);
      const decision = await fetch(
        `${base}/api/admin/avatar-reviews/${review.id}`,
        {
          method: 'POST',
          headers: { ...adminHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' }),
        }
      );
      expect(decision.status).toBe(200);
      expect(
        (
          await fetch(
            `${base}/api/people/v2/avatars/${username}/${review.sha256}.webp`
          )
        ).status
      ).toBe(200);
      expect(
        (
          await fetch(
            `${base}/api/people/v2/avatars/${username}/${approvedJson.sha256}.webp`
          )
        ).status
      ).toBe(404);
      child!.kill('SIGTERM');
      expect(await child!.exited).toBe(process.platform === 'win32' ? 143 : 0);
      child = undefined;
      githubChild!.kill('SIGTERM');
      expect(await githubChild!.exited).toBe(
        process.platform === 'win32' ? 143 : 0
      );
      githubChild = undefined;
      await expect(fetch(`${base}/readyz`)).rejects.toThrow();
      await expect(fetch(`${githubBase}/readyz`)).rejects.toThrow();
    } finally {
      if (child) {
        child.kill('SIGTERM');
        await child.exited;
      }
      if (githubChild) {
        githubChild.kill('SIGTERM');
        await githubChild.exited;
      }
      profileServer.stop(true);
      await Promise.all([
        storage.delete(`avatars/${username}/current.json`),
        ...[...imageKeys].map((key) => storage.delete(key)),
      ]);
      await pool.end();
      await operationPool.end();
      await admin.query(`DROP SCHEMA IF EXISTS "${queueSchema}" CASCADE`);
      await admin.query(`DROP SCHEMA IF EXISTS "${operationSchema}" CASCADE`);
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  },
  90_000
);
