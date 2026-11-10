import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  type BinaryObjectStore,
  StorageDriverConfigSchema,
} from '@scs/storage';
import { createFileStore } from '@scs/storage/fs';
import { createR2Store } from '@scs/storage/r2';
import { createS3Store } from '@scs/storage/s3';
import { afterEach, describe, expect, test } from 'bun:test';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

function r2Store(): BinaryObjectStore {
  const objects = new Map<
    string,
    { bytes: Uint8Array; etag: string; contentType?: string }
  >();
  let revision = 0;
  const bucket = {
    async get(key: string) {
      const object = objects.get(key);
      return object
        ? {
            ...this.object(key, object),
            body: new Blob([object.bytes.slice().buffer]).stream(),
          }
        : null;
    },
    object(
      key: string,
      object: { bytes: Uint8Array; etag: string; contentType?: string }
    ) {
      return {
        key,
        etag: object.etag,
        size: object.bytes.length,
        httpMetadata: { contentType: object.contentType },
      };
    },
    async head(key: string) {
      const object = objects.get(key);
      return object ? this.object(key, object) : null;
    },
    async put(key: string, value: Uint8Array | string, options?: R2PutOptions) {
      const prior = objects.get(key);
      const condition = options?.onlyIf;
      if (
        condition &&
        'etagDoesNotMatch' in condition &&
        condition.etagDoesNotMatch === '*' &&
        prior
      )
        return null;
      if (
        condition &&
        'etagMatches' in condition &&
        prior?.etag !== condition.etagMatches
      )
        return null;
      const bytes =
        typeof value === 'string' ? new TextEncoder().encode(value) : value;
      const object = {
        bytes,
        etag: `r${++revision}`,
        contentType:
          options?.httpMetadata && 'contentType' in options.httpMetadata
            ? options.httpMetadata.contentType
            : undefined,
      };
      objects.set(key, object);
      return this.object(key, object);
    },
    async delete(key: string) {
      objects.delete(key);
    },
  };
  return createR2Store(bucket as unknown as R2Bucket);
}

async function checkContract(store: BinaryObjectStore) {
  expect(await store.get('missing')).toBeNull();
  expect(await store.head('missing')).toBeNull();
  const source = new Uint8Array([0, 255, 128, 1, 10]);
  const created = await store.put('avatars/a.webp', source, {
    condition: { kind: 'create' },
    metadata: { contentType: 'image/webp', custom: { purpose: 'test' } },
  });
  expect(created?.size).toBe(source.length);
  expect((await store.head('avatars/a.webp'))?.metadata.contentType).toBe(
    'image/webp'
  );
  expect(
    new Uint8Array(
      await new Response(
        (await store.get('avatars/a.webp'))!.body
      ).arrayBuffer()
    )
  ).toEqual(source);
  expect(
    await store.put('avatars/a.webp', 'overwrite', {
      condition: { kind: 'create' },
    })
  ).toBeNull();
  const outcomes = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      store.put('avatars/a.webp', `writer-${index}`, {
        condition: { kind: 'match', etag: created!.etag },
      })
    )
  );
  expect(outcomes.filter(Boolean)).toHaveLength(1);
  expect(
    await store.put('avatars/a.webp', 'stale', {
      condition: { kind: 'match', etag: created!.etag },
    })
  ).toBeNull();
  await store.delete('avatars/a.webp');
  expect(await store.get('avatars/a.webp')).toBeNull();
}

describe('binary object drivers', () => {
  test('native R2 contract', async () => checkContract(r2Store()));
  test('filesystem contract with two independent instances', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scs-storage-'));
    roots.push(root);
    const a = createFileStore({ driver: 'fs', root });
    const b = createFileStore({ driver: 'fs', root });
    await checkContract(a);
    const created = await a.put('pointer', 'old', {
      condition: { kind: 'create' },
    });
    const results = await Promise.all(
      [a, b].map((store, index) =>
        store.put('pointer', `new-${index}`, {
          condition: { kind: 'match', etag: created!.etag },
        })
      )
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  test('rejects invalid configuration and traversal', async () => {
    expect(() =>
      StorageDriverConfigSchema.parse({ driver: 's3', bucket: '' })
    ).toThrow();
    const root = await mkdtemp(join(tmpdir(), 'scs-storage-'));
    roots.push(root);
    await expect(
      createFileStore({ driver: 'fs', root }).put('../escape', 'x')
    ).rejects.toThrow('Invalid object key');
  });
  test('S3 sends conditional headers and maps precondition failures', async () => {
    const commands: Array<{ input: Record<string, unknown> }> = [];
    const objects = new Map<string, string>();
    let revision = 0;
    const client = {
      send: async (command: { input: Record<string, unknown> }) => {
        commands.push(command);
        const key = command.input.Key as string;
        if (command.constructor.name === 'DeleteObjectCommand') {
          objects.delete(key);
          return {};
        }
        const old = objects.get(key);
        if (
          (command.input.IfNoneMatch === '*' && old) ||
          (command.input.IfMatch && old !== command.input.IfMatch)
        )
          throw Object.assign(new Error('conflict'), {
            name: 'PreconditionFailed',
          });
        const etag = `"${++revision}"`;
        objects.set(key, etag);
        return { ETag: etag };
      },
    };
    const store = createS3Store(
      {
        driver: 's3',
        bucket: 'test',
        region: 'us-east-1',
        accessKeyId: 'a',
        secretAccessKey: 'b',
      },
      client as never
    );
    const created = await store.put('pointer', 'x', {
      condition: { kind: 'create' },
    });
    expect(created?.etag).toBeTruthy();
    expect(
      commands.find((command) => command.input.Key === 'pointer')?.input
        .IfNoneMatch
    ).toBe('*');
    expect(
      await store.put('pointer', 'y', {
        condition: { kind: 'match', etag: 'stale' },
      })
    ).toBeNull();
    expect(commands[commands.length - 1]?.input.IfMatch).toBe('"stale"');
  });
  test('S3 fails closed when a provider ignores conditional headers', async () => {
    const client = {
      send: async () => ({ ETag: '"same"' }),
    };
    const store = createS3Store(
      {
        driver: 's3',
        bucket: 'test',
        region: 'us-east-1',
        accessKeyId: 'a',
        secretAccessKey: 'b',
      },
      client as never
    );
    await expect(
      store.put('pointer', 'x', { condition: { kind: 'create' } })
    ).rejects.toThrow('conditional creation is not atomic');
  });
  test('S3 rejects a provider that ignores ETag replacement', async () => {
    let creates = 0;
    const client = {
      send: async (command: { input: Record<string, unknown> }) => {
        if (command.input.IfNoneMatch && ++creates > 1)
          throw Object.assign(new Error('conflict'), {
            name: 'PreconditionFailed',
          });
        return { ETag: '"revision"' };
      },
    };
    const store = createS3Store(
      {
        driver: 's3',
        bucket: 'test',
        region: 'us-east-1',
        accessKeyId: 'a',
        secretAccessKey: 'b',
      },
      client as never
    );
    await expect(
      store.put('pointer', 'x', { condition: { kind: 'create' } })
    ).rejects.toThrow('conditional replacement is not atomic');
  });
  test('S3 distinguishes missing objects and provider failures', async () => {
    let failure = 'NoSuchKey';
    const client = {
      send: async () => {
        throw Object.assign(new Error(failure), { name: failure });
      },
    };
    const store = createS3Store(
      {
        driver: 's3',
        bucket: 'test',
        region: 'us-east-1',
        accessKeyId: 'a',
        secretAccessKey: 'b',
      },
      client as never
    );
    expect(await store.get('absent')).toBeNull();
    failure = 'NotFound';
    expect(await store.head('absent')).toBeNull();
    failure = 'AccessDenied';
    await expect(store.get('absent')).rejects.toThrow('AccessDenied');
    await expect(
      store.put('key', 'data', { condition: { kind: 'create' } })
    ).rejects.toThrow('AccessDenied');
  });
});
