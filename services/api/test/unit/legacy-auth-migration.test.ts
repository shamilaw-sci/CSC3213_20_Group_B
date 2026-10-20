import { describe, expect, test } from 'bun:test';

import {
  migrateLegacyAuth,
  normalizeLegacyPasskeyPublicKey,
} from '@/services/legacy-auth-migration.service';
import { createTestEnv } from 'test/helpers/create-test-env';

describe('legacy Better Auth migration', () => {
  test('converts WebAuthn base64url public keys to padded base64', () => {
    expect(normalizeLegacyPasskeyPublicKey('ab-c_d')).toBe('ab+c/d==');
  });

  test('moves identities and passkeys to D1 and removes legacy KV fields', async () => {
    const env = createTestEnv();
    const ordinaryPermission = JSON.stringify({
      role: 'ACADEMIC',
      name: 'Unchanged Academic',
    });
    await env.PERMISSIONS.put(
      'permissions:academic@pdn.ac.lk',
      ordinaryPermission
    );
    await env.PERMISSIONS.put(
      'permissions:student@pdn.ac.lk',
      JSON.stringify({
        role: 'STUDENT',
        name: 'Student',
        githubUserID: 12345,
        oAuthProviders: { github: true },
        passkeys: [
          {
            id: 'credential-one',
            publicKey: 'ab-c_d',
            counter: 2,
            backedUp: true,
            deviceType: 'multiDevice',
            transports: ['internal'],
          },
        ],
      })
    );

    const result = await migrateLegacyAuth(env);

    expect(result).toMatchObject({
      scanned: 2,
      usersCreated: 1,
      githubAccountsCreated: 1,
      passkeysCreated: 1,
      permissionsCleaned: 1,
      skipped: 1,
      conflicts: [],
    });
    expect(
      await env.AUTH_DB.prepare(
        'SELECT accountId FROM account WHERE providerId = ?'
      )
        .bind('github')
        .first<{ accountId: string }>()
    ).toEqual({ accountId: '12345' });
    expect(
      await env.AUTH_DB.prepare(
        'SELECT publicKey FROM passkey WHERE credentialID = ?'
      )
        .bind('credential-one')
        .first<{ publicKey: string }>()
    ).toEqual({ publicKey: 'ab+c/d==' });
    expect(
      JSON.parse(
        (await env.PERMISSIONS.get('permissions:student@pdn.ac.lk')) ?? '{}'
      )
    ).toEqual({ role: 'STUDENT', accessLevel: 'NONE', name: 'Student' });
    expect(await env.PERMISSIONS.get('permissions:academic@pdn.ac.lk')).toBe(
      ordinaryPermission
    );
  });
});
