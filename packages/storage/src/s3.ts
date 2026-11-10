import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import {
  assertObjectKey,
  bareEtag,
  type BinaryObjectStore,
  type ObjectBody,
  type ObjectInfo,
  StorageDriverConfigSchema,
  StorageGuaranteeError,
} from '#storage/index';

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error && ['NoSuchKey', 'NotFound'].includes(error.name)
  );
}

function isConflict(error: unknown): boolean {
  return (
    error instanceof Error &&
    ['PreconditionFailed', 'ConditionalRequestConflict'].includes(error.name)
  );
}

function info(
  key: string,
  etag: string | undefined,
  size: number | undefined,
  contentType?: string,
  custom?: Record<string, string>
): ObjectInfo {
  if (!etag || size === undefined)
    throw new StorageGuaranteeError('S3 response omitted ETag or size');
  return {
    key,
    etag: bareEtag(etag),
    size,
    metadata: {
      ...(contentType ? { contentType } : {}),
      ...(custom ? { custom } : {}),
    },
  };
}

async function bytes(body: ObjectBody): Promise<Uint8Array> {
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

async function verifyDigest(
  data: Uint8Array,
  expected?: string
): Promise<void> {
  if (!expected) return;
  const actual = Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new Uint8Array(data).buffer)
    )
  )
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('');
  if (actual !== expected)
    throw new StorageGuaranteeError('Object SHA-256 mismatch');
}

export function createS3Store(
  input: unknown,
  injectedClient?: S3Client
): BinaryObjectStore {
  const config = StorageDriverConfigSchema.parse(input);
  if (config.driver !== 's3')
    throw new Error('Expected S3 storage configuration');
  const client =
    injectedClient ??
    new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  const bucket = config.bucket;
  let verification: Promise<void> | undefined;

  async function verifyConditionalWrites(): Promise<void> {
    const key = `__scs_storage_probe__/${crypto.randomUUID()}`;
    const write = async (
      value: number,
      condition: { IfNoneMatch: '*' } | { IfMatch: string }
    ) => {
      try {
        const result = await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: new Uint8Array([value]),
            ...condition,
          })
        );
        if (!result.ETag)
          throw new StorageGuaranteeError('S3 probe response omitted ETag');
        return result.ETag;
      } catch (error) {
        if (isConflict(error)) return null;
        throw error;
      }
    };
    try {
      const createResults = await Promise.allSettled([
        write(1, { IfNoneMatch: '*' }),
        write(2, { IfNoneMatch: '*' }),
      ]);
      const createFailure = createResults.find(
        (result) => result.status === 'rejected'
      );
      if (createFailure?.status === 'rejected') throw createFailure.reason;
      const creates = createResults.map((result) =>
        result.status === 'fulfilled' ? result.value : null
      );
      if (creates.filter(Boolean).length !== 1)
        throw new StorageGuaranteeError(
          'S3 conditional creation is not atomic'
        );
      const etag = creates.find(Boolean)!;
      const replacementResults = await Promise.allSettled([
        write(3, { IfMatch: etag }),
        write(4, { IfMatch: etag }),
      ]);
      const replacementFailure = replacementResults.find(
        (result) => result.status === 'rejected'
      );
      if (replacementFailure?.status === 'rejected')
        throw replacementFailure.reason;
      const replacements = replacementResults.map((result) =>
        result.status === 'fulfilled' ? result.value : null
      );
      if (replacements.filter(Boolean).length !== 1)
        throw new StorageGuaranteeError(
          'S3 conditional replacement is not atomic'
        );
    } finally {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
  }

  return {
    capabilities: { conditionalCreate: true, conditionalReplace: true },
    async get(key) {
      assertObjectKey(key);
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key })
        );
        if (!result.Body)
          throw new StorageGuaranteeError('S3 response omitted body');
        return {
          ...info(
            key,
            result.ETag,
            result.ContentLength,
            result.ContentType,
            result.Metadata
          ),
          body: result.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        };
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async head(key) {
      assertObjectKey(key);
      try {
        const result = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key })
        );
        return info(
          key,
          result.ETag,
          result.ContentLength,
          result.ContentType,
          result.Metadata
        );
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async put(key, body, options) {
      assertObjectKey(key);
      if (options?.condition) {
        verification ??= verifyConditionalWrites();
        await verification;
      }
      const data = await bytes(body);
      await verifyDigest(data, options?.sha256);
      try {
        const result = await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: data,
            ContentLength: data.byteLength,
            ...(options?.metadata?.contentType
              ? { ContentType: options.metadata.contentType }
              : {}),
            ...(options?.metadata?.custom
              ? { Metadata: options.metadata.custom }
              : {}),
            ...(options?.condition?.kind === 'create'
              ? { IfNoneMatch: '*' }
              : {}),
            ...(options?.condition?.kind === 'match'
              ? { IfMatch: `"${bareEtag(options.condition.etag)}"` }
              : {}),
          })
        );
        return info(
          key,
          result.ETag,
          data.byteLength,
          options?.metadata?.contentType,
          options?.metadata?.custom
        );
      } catch (error) {
        if (isConflict(error)) return null;
        throw error;
      }
    },
    async delete(key) {
      assertObjectKey(key);
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
