import {
  assertObjectKey,
  type BinaryObjectStore,
  type ObjectInfo,
} from '#storage/index';

function info(key: string, object: R2Object): ObjectInfo {
  return {
    key,
    etag: object.etag,
    size: object.size,
    metadata: {
      ...(object.httpMetadata?.contentType
        ? { contentType: object.httpMetadata.contentType }
        : {}),
      ...(object.customMetadata ? { custom: object.customMetadata } : {}),
    },
  };
}

export function createR2Store(bucket: R2Bucket): BinaryObjectStore {
  return {
    capabilities: { conditionalCreate: true, conditionalReplace: true },
    async get(key) {
      assertObjectKey(key);
      const object = await bucket.get(key);
      return object && 'body' in object
        ? { ...info(key, object), body: object.body }
        : null;
    },
    async head(key) {
      assertObjectKey(key);
      const object = await bucket.head(key);
      return object ? info(key, object) : null;
    },
    async put(key, body, options) {
      assertObjectKey(key);
      const object = await bucket.put(key, body, {
        ...(options?.condition
          ? {
              onlyIf:
                options.condition.kind === 'create'
                  ? { etagDoesNotMatch: '*' }
                  : { etagMatches: options.condition.etag },
            }
          : {}),
        ...(options?.metadata?.contentType
          ? { httpMetadata: { contentType: options.metadata.contentType } }
          : {}),
        ...(options?.metadata?.custom
          ? { customMetadata: options.metadata.custom }
          : {}),
        ...(options?.sha256 ? { sha256: options.sha256 } : {}),
      });
      return object ? info(key, object) : null;
    },
    async delete(key) {
      assertObjectKey(key);
      await bucket.delete(key);
    },
  };
}
