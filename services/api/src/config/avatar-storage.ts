import {
  StorageDriverConfigSchema,
  type BinaryObjectStore,
} from '@scs/storage';
import { createR2Store } from '@scs/storage/r2';
import { createS3Store } from '@scs/storage/s3';

import type { Env } from '@/types/env';

const stores = new WeakMap<Env, BinaryObjectStore>();

export function avatarStore(env: Env): BinaryObjectStore {
  if (env.AVATAR_STORAGE) return env.AVATAR_STORAGE;
  const cached = stores.get(env);
  if (cached) return cached;
  const driver = env.AVATAR_STORAGE_DRIVER ?? 'r2';
  const config = StorageDriverConfigSchema.parse(
    driver === 's3'
      ? {
          driver,
          bucket: env.AVATAR_S3_BUCKET,
          region: env.AVATAR_S3_REGION,
          endpoint: env.AVATAR_S3_ENDPOINT,
          accessKeyId: env.AVATAR_S3_ACCESS_KEY_ID,
          secretAccessKey: env.AVATAR_S3_SECRET_ACCESS_KEY,
          forcePathStyle: true,
        }
      : { driver }
  );
  const store =
    config.driver === 'r2'
      ? createR2Store(
          env.PROFILE_PICTURES ??
            (() => {
              throw new Error('R2 binding is unavailable');
            })()
        )
      : config.driver === 's3'
        ? createS3Store(config)
        : (() => {
            throw new Error('Filesystem storage requires a Node host');
          })();
  stores.set(env, store);
  return store;
}
