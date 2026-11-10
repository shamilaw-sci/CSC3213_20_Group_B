import { z } from 'zod';

export const StorageDriverConfigSchema = z.discriminatedUnion('driver', [
  z.object({ driver: z.literal('r2') }),
  z.object({
    driver: z.literal('s3'),
    bucket: z.string().min(1),
    region: z.string().min(1),
    endpoint: z.url().optional(),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1),
    forcePathStyle: z.boolean().default(true),
  }),
  z.object({ driver: z.literal('fs'), root: z.string().min(1) }),
]);

export type StorageDriverConfig = z.infer<typeof StorageDriverConfigSchema>;
export type ObjectBody =
  Uint8Array | ArrayBuffer | string | ReadableStream<Uint8Array>;
export type PutCondition = { kind: 'create' } | { kind: 'match'; etag: string };

export interface ObjectMetadata {
  contentType?: string;
  custom?: Record<string, string>;
}

export interface ObjectInfo {
  key: string;
  etag: string;
  size: number;
  metadata: ObjectMetadata;
}

export interface StoredObject extends ObjectInfo {
  body: ReadableStream<Uint8Array>;
}

export interface PutOptions {
  metadata?: ObjectMetadata;
  /** Optional SHA-256 hex digest of the bytes being written. */
  sha256?: string;
  /** Checked atomically with the write. A failed condition returns null. */
  condition?: PutCondition;
}

export interface BinaryObjectStore {
  readonly capabilities: { conditionalCreate: true; conditionalReplace: true };
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<ObjectInfo | null>;
  put(
    key: string,
    body: ObjectBody,
    options?: PutOptions
  ): Promise<ObjectInfo | null>;
  delete(key: string): Promise<void>;
}

export class StorageGuaranteeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageGuaranteeError';
  }
}

export function assertObjectKey(key: string): void {
  if (
    !key ||
    key.startsWith('/') ||
    key.includes('\\') ||
    key.split('/').some((part) => part === '..' || part === '.' || !part)
  )
    throw new Error('Invalid object key');
}

export function bareEtag(etag: string): string {
  return etag.replace(/^"|"$/g, '');
}
