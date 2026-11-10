import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';

import {
  assertObjectKey,
  type BinaryObjectStore,
  type ObjectBody,
  type ObjectInfo,
  StorageDriverConfigSchema,
  StorageGuaranteeError,
} from '#storage/index';

interface Header {
  etag: string;
  metadata: ObjectInfo['metadata'];
}

async function bytes(body: ObjectBody): Promise<Uint8Array> {
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

function unpack(
  key: string,
  data: Uint8Array
): { info: ObjectInfo; body: Uint8Array } {
  const offset = data.indexOf(10);
  if (offset < 0)
    throw new StorageGuaranteeError('Corrupt local object header');
  const header = JSON.parse(
    new TextDecoder().decode(data.subarray(0, offset))
  ) as Header;
  if (!header.etag || !header.metadata)
    throw new StorageGuaranteeError('Corrupt local object metadata');
  const body = data.subarray(offset + 1);
  return {
    info: {
      key,
      etag: header.etag,
      size: body.byteLength,
      metadata: header.metadata,
    },
    body,
  };
}

export function createFileStore(input: unknown): BinaryObjectStore {
  const config = StorageDriverConfigSchema.parse(input);
  if (config.driver !== 'fs')
    throw new Error('Expected filesystem storage configuration');
  if (!isAbsolute(config.root))
    throw new Error('Filesystem root must be absolute');
  const root = resolve(config.root);
  function path(key: string): string {
    assertObjectKey(key);
    const result = resolve(root, key);
    if (!result.startsWith(root + sep)) throw new Error('Invalid object key');
    return result;
  }
  async function read(key: string) {
    try {
      return unpack(key, new Uint8Array(await readFile(path(key))));
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return null;
      throw error;
    }
  }
  async function locked<T>(
    target: string,
    action: () => Promise<T>
  ): Promise<T> {
    const lock = `${target}.lock`;
    await mkdir(dirname(target), { recursive: true });
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        await mkdir(lock);
        try {
          return await action();
        } finally {
          await rm(lock, { recursive: true });
        }
      } catch (error) {
        if (!(
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'EEXIST'
        ))
          throw error;
        await new Promise((done) => setTimeout(done, 10));
      }
    }
    throw new StorageGuaranteeError('Could not acquire local object lock');
  }
  return {
    capabilities: { conditionalCreate: true, conditionalReplace: true },
    async get(key) {
      const found = await read(key);
      return found
        ? {
            ...found.info,
            body: new Blob([found.body.slice().buffer]).stream(),
          }
        : null;
    },
    async head(key) {
      return (await read(key))?.info ?? null;
    },
    async put(key, body, options) {
      const target = path(key);
      const data = await bytes(body);
      if (options?.sha256) {
        const digest = Array.from(
          new Uint8Array(
            await crypto.subtle.digest('SHA-256', new Uint8Array(data).buffer)
          )
        )
          .map((part) => part.toString(16).padStart(2, '0'))
          .join('');
        if (digest !== options.sha256)
          throw new StorageGuaranteeError('Object SHA-256 mismatch');
      }
      return locked(target, async () => {
        const before = await read(key);
        if (options?.condition?.kind === 'create' && before) return null;
        if (
          options?.condition?.kind === 'match' &&
          before?.info.etag !== options.condition.etag
        )
          return null;
        const etag = crypto.randomUUID();
        const metadata = options?.metadata ?? {};
        const header = new TextEncoder().encode(
          JSON.stringify({ etag, metadata }) + '\n'
        );
        const packed = new Uint8Array(header.length + data.length);
        packed.set(header);
        packed.set(data, header.length);
        const temporary = `${target}.${crypto.randomUUID()}.tmp`;
        try {
          await writeFile(temporary, packed, { flag: 'wx' });
          await rename(temporary, target);
        } finally {
          await rm(temporary, { force: true });
        }
        return { key, etag, size: data.length, metadata };
      });
    },
    async delete(key) {
      const target = path(key);
      await locked(target, async () => {
        await rm(target, { force: true });
      });
    },
  };
}
