import { expect, test } from 'bun:test';
import {
  HonoursBulkOperationRequestSchema,
  HonoursPreviewRequestSchema,
  HonoursPreviewResponseSchema,
  IdentityAccountSchema,
  IdentityDecisionRequestSchema,
} from '@scs/schemas';

test('identity decision contract validates roles and review status', () => {
  expect(
    IdentityDecisionRequestSchema.safeParse({
      email: 'staff@sci.pdn.ac.lk',
      expectedRole: 'OTHER',
      role: 'ACADEMIC',
      status: 'APPROVED',
      source: 'REVIEW',
      note: 'Appointment',
    }).success
  ).toBe(true);
  expect(
    IdentityDecisionRequestSchema.safeParse({
      email: 'staff@sci.pdn.ac.lk',
      expectedRole: 'OTHER',
      role: 'ADMIN',
      status: 'APPROVED',
      source: 'REVIEW',
      note: '',
    }).success
  ).toBe(false);
  expect(
    IdentityAccountSchema.safeParse({
      email: 'staff@sci.pdn.ac.lk',
      name: 'Staff',
      role: 'OTHER',
      accessLevel: 'NONE',
      createdAt: null,
      emailVerified: true,
      status: 'PENDING',
      source: 'AUTOMATIC',
      reviewedBy: null,
      reviewedAt: null,
      note: '',
    }).success
  ).toBe(true);
});

test('Honours operation contract rejects duplicate, wrong-batch, and mismatched changes', () => {
  const change = {
    identifier: 'S21801',
    oldTrack: 'GENERAL',
    oldProgramme: null,
    newTrack: 'HONOURS',
    newProgramme: 'STATISTICS',
  };
  const request = {
    batch: 's21',
    programme: 'STATISTICS',
    operation: 'assign',
    reason: 'Approved by department board',
    updatedBy: 'admin@sci.pdn.ac.lk',
    changes: [change],
  };
  expect(HonoursBulkOperationRequestSchema.safeParse(request).success).toBe(
    true
  );
  expect(
    HonoursBulkOperationRequestSchema.safeParse({
      ...request,
      changes: [change, change],
    }).success
  ).toBe(false);
  expect(
    HonoursBulkOperationRequestSchema.safeParse({
      ...request,
      changes: [{ ...change, identifier: 'S22801' }],
    }).success
  ).toBe(false);
  expect(
    HonoursBulkOperationRequestSchema.safeParse({
      ...request,
      changes: [{ ...change, newProgramme: 'CHEMISTRY' }],
    }).success
  ).toBe(false);
});

test('Honours preview contract uses the published programme codes', () => {
  expect(
    HonoursPreviewRequestSchema.safeParse({
      batch: 's21',
      programme: 'STATISTICS_AND_OPERATIONS_RESEARCH',
      include: '800-899',
      exclude: '',
      additional: '',
      operation: 'assign',
    }).success
  ).toBe(true);
  expect(
    HonoursPreviewResponseSchema.safeParse({
      batch: 's21',
      programme: 'STATISTICS_AND_OPERATIONS_RESEARCH',
      operation: 'assign',
      total: 1,
      excluded: [],
      counts: { planned_assign: 1 },
      entries: [
        {
          identifier: 'S21801',
          outcome: 'planned_assign',
          oldTrack: 'GENERAL',
          oldProgramme: null,
          newTrack: 'HONOURS',
          newProgramme: 'STATISTICS_AND_OPERATIONS_RESEARCH',
        },
      ],
    }).success
  ).toBe(true);
});
