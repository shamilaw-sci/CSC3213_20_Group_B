import { describe, expect, test } from 'bun:test';

import {
  ApiErrorEnvelopeSchema,
  ApiErrorSchema,
  CorrelationIdSchema,
} from '#index';

describe('versioned API error contract', () => {
  test('accepts a bounded machine-readable conflict', () => {
    const result = ApiErrorEnvelopeSchema.parse({
      version: 1,
      error: {
        code: 'entity_revision_conflict',
        message: 'The project changed after it was loaded.',
        correlationId: 'req_01JAA2V8M7X4G9NK2QF6D3P1ZT',
        conflict: {
          resourceType: 'project',
          resourceId: 'scholarship-management-system',
          expectedRevision: 'commit-41',
          actualRevision: 'commit-42',
        },
      },
    });

    expect(result.error.code).toBe('entity_revision_conflict');
  });

  test('rejects unstable codes, unbounded messages, and invalid correlations', () => {
    expect(
      ApiErrorSchema.safeParse({ code: 'Bad Code', message: 'No' }).success
    ).toBe(false);
    expect(
      ApiErrorSchema.safeParse({
        code: 'invalid_request',
        message: 'x'.repeat(501),
      }).success
    ).toBe(false);
    expect(
      CorrelationIdSchema.safeParse('request id with spaces').success
    ).toBe(false);
    expect(
      ApiErrorSchema.safeParse({
        code: 'invalid_request',
        message: 'A correlation ID is required.',
      }).success
    ).toBe(false);
  });
});
