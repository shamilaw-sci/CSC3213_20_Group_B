import type { PublicProfileKind } from '@scs/schemas';

import { JsonRecordSchema } from '@/utils/json-record';

export class SelfHonoursConflictError extends Error {
  readonly status = 409;

  constructor() {
    super('Student Honours classification changed; refresh before editing');
  }
}

/** Compare with GitHub's current record at the write boundary, including drafts. */
export function assertSelfHonoursUnchanged(input: {
  profileKind: PublicProfileKind;
  updatedByType?: 'self' | 'admin';
  profile: unknown;
  currentContent: string | null | undefined;
}): void {
  if (input.profileKind !== 'student' || input.updatedByType !== 'self') return;
  const proposed = JsonRecordSchema.parse(input.profile);
  const current = input.currentContent
    ? JsonRecordSchema.safeParse(JSON.parse(input.currentContent))
    : null;
  if (current && !current.success) throw new SelfHonoursConflictError();
  const oldTrack = current?.data.studentTrack ?? 'GENERAL';
  const oldProgramme = current?.data.honoursProgramme;
  if (
    (proposed.studentTrack ?? 'GENERAL') !== oldTrack ||
    proposed.honoursProgramme !== oldProgramme
  ) {
    throw new SelfHonoursConflictError();
  }
}
