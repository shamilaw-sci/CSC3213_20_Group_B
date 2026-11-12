import { describe, expect, test } from 'bun:test';

import {
  MutationAcceptedSchema,
  MutationControlSchema,
  OperationStatusResponseSchema,
} from '#index';

const operationBase = {
  version: 1,
  operationId: 'op_01JAA2V8M7X4G9NK2QF6D3P1ZT',
  resource: { type: 'project', id: 'scholarship-management-system' },
  actor: { type: 'user', subjectId: 'usr_01JAA2V8M7X4G9NK2QF6D3P1ZT' },
  createdAt: '2026-10-19T08:00:00.000Z',
  updatedAt: '2026-10-19T08:00:01.000Z',
};

describe('durable operation contracts', () => {
  test('accepts queued and terminal actor-safe responses', () => {
    expect(
      OperationStatusResponseSchema.parse({
        ...operationBase,
        status: 'queued',
      }).status
    ).toBe('queued');

    expect(
      OperationStatusResponseSchema.parse({
        ...operationBase,
        status: 'succeeded',
        completedAt: '2026-10-19T08:00:01.000Z',
        outcome: {
          status: 'succeeded',
          revision: 'commit-42',
          pullRequest: {
            number: 42,
            url: 'https://github.com/scs-pdn/data/pull/42',
          },
        },
      }).status
    ).toBe('succeeded');
  });

  test('does not accept an email address as an actor subject identifier', () => {
    expect(
      OperationStatusResponseSchema.safeParse({
        ...operationBase,
        actor: { type: 'user', subjectId: 'admin@pdn.ac.lk' },
        status: 'queued',
      }).success
    ).toBe(false);
  });

  test('keeps PR creation distinct from verified publication', () => {
    const base = {
      ...operationBase,
      status: 'succeeded',
      completedAt: '2026-10-19T08:00:01.000Z',
      outcome: {
        status: 'succeeded',
        pullRequest: {
          number: 42,
          url: 'https://github.com/scs-pdn/data/pull/42',
        },
      },
    };
    expect(OperationStatusResponseSchema.parse(base)).not.toHaveProperty(
      'publication'
    );
    expect(
      OperationStatusResponseSchema.parse({
        ...base,
        publication: 'checks_failed',
        cleanupEligible: true,
      })
    ).toMatchObject({
      status: 'succeeded',
      publication: 'checks_failed',
      cleanupEligible: true,
    });
  });

  test('requires idempotency and returns a pollable accepted response', () => {
    expect(
      MutationControlSchema.parse({
        idempotencyKey: 'idem_01JAA2V8M7X4G9NK2QF6D3P1ZT',
        expectedRevision: 'commit-41',
      })
    ).toEqual({
      idempotencyKey: 'idem_01JAA2V8M7X4G9NK2QF6D3P1ZT',
      expectedRevision: 'commit-41',
    });

    expect(
      MutationAcceptedSchema.parse({
        version: 1,
        operationId: operationBase.operationId,
        status: 'queued',
        statusUrl: `/api/operations/${operationBase.operationId}`,
        retryAfterMs: 1_000,
      }).status
    ).toBe('queued');

    expect(
      MutationAcceptedSchema.parse({
        version: 1,
        operationId: operationBase.operationId,
        status: 'running',
        statusUrl: `/api/operations/${operationBase.operationId}`,
        retryAfterMs: 1_000,
      }).status
    ).toBe('running');
  });
});
