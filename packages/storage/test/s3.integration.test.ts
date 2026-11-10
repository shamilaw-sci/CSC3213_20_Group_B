import { createS3Store } from '@scs/storage/s3';
import { expect, test } from 'bun:test';

const enabled = process.env.S3_TEST_BUCKET?.startsWith('scs-phase6-test-');
const integrationTest = enabled ? test : test.skip;

integrationTest(
  'S3 preserves binary objects and atomic conditional writes',
  async () => {
    const config = {
      driver: 's3' as const,
      bucket: process.env.S3_TEST_BUCKET!,
      endpoint: process.env.S3_TEST_ENDPOINT!,
      region: process.env.S3_TEST_REGION!,
      accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY!,
    };
    const first = createS3Store(config);
    const second = createS3Store(config);
    const key = `phase6/${crypto.randomUUID()}`;
    try {
      expect(await first.get(key)).toBeNull();
      expect(await first.head(key)).toBeNull();
      const bytes = new Uint8Array([0, 1, 128, 255]);
      const creates = await Promise.all([
        first.put(key, bytes, {
          condition: { kind: 'create' },
          metadata: {
            contentType: 'application/octet-stream',
            custom: { purpose: 'test' },
          },
        }),
        second.put(key, bytes, {
          condition: { kind: 'create' },
          metadata: {
            contentType: 'application/octet-stream',
            custom: { purpose: 'test' },
          },
        }),
      ]);
      expect(creates.filter(Boolean)).toHaveLength(1);
      const object = await first.get(key);
      expect(object).not.toBeNull();
      expect(object?.metadata.contentType).toBe('application/octet-stream');
      expect(object?.metadata.custom?.purpose).toBe('test');
      const original = new Uint8Array(
        await new Response(object!.body).arrayBuffer()
      );
      expect(original).toEqual(bytes);
      const etag = object!.etag;
      const replacements = await Promise.all([
        first.put(key, new Uint8Array([7]), {
          condition: { kind: 'match', etag },
        }),
        second.put(key, new Uint8Array([8]), {
          condition: { kind: 'match', etag },
        }),
      ]);
      expect(replacements.filter(Boolean)).toHaveLength(1);
      expect((await first.head(key))?.etag).toBe(
        replacements.find(Boolean)?.etag
      );
      expect(
        await first.put(key, bytes, { condition: { kind: 'match', etag } })
      ).toBeNull();
    } finally {
      await first.delete(key);
    }
    expect(await first.get(key)).toBeNull();
  },
  60_000
);
