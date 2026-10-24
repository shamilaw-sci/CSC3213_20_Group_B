import { z } from 'zod';

import { EntityRevisionSchema } from '#schemas/api/mutation.schema';
import {
  PostgraduateProgrammeSchema,
  SlqfLevelSchema,
  StudentLevelSchema,
  StudentStatusSchema,
  StudentTrackSchema,
} from '#schemas/people/students/student.schema';

const EditorRecordSchema = z.record(z.string(), z.unknown());
const LockedFieldsSchema = z.array(z.string().trim().min(1)).max(50);

export const EditorPullRequestStatusSchema = z.enum([
  'none',
  'open',
  'merged',
  'closed',
  'checks_pending',
  'checks_failed',
  'auto_merge_queued',
]);

export const PublicProfileKindSchema = z.enum([
  'academic',
  'academic-support',
  'non-academic',
  'student',
]);

export const StudentPlacementResponseSchema = z.discriminatedUnion(
  'studentType',
  [
    z
      .object({
        registrationNo: z.string().trim().min(1),
        studentType: z.literal('UNDERGRADUATE'),
        studentTrack: StudentTrackSchema,
        level: StudentLevelSchema,
        status: StudentStatusSchema,
        lockedFields: LockedFieldsSchema,
      })
      .strict(),
    z
      .object({
        registrationNo: z.string().trim().min(1),
        studentType: z.literal('POSTGRADUATE'),
        postgraduateProgramme: PostgraduateProgrammeSchema,
        slqfLevel: SlqfLevelSchema,
        status: StudentStatusSchema,
        lockedFields: LockedFieldsSchema,
      })
      .strict(),
  ]
);

export const PublicProfileSchemaResponseSchema = z
  .object({
    allowedKinds: z.array(PublicProfileKindSchema).max(4),
    identity: z
      .object({
        email: z.email(),
        username: z.string().trim().min(1),
        studentPlacement: StudentPlacementResponseSchema.optional(),
      })
      .strict()
      .optional(),
    lockedFields: LockedFieldsSchema.optional(),
    note: z.string().trim().min(1),
  })
  .strict();

export const PublicProfilePrSchema = z
  .object({
    status: EditorPullRequestStatusSchema,
    number: z.number().int().positive().optional(),
    url: z.url().optional(),
    branch: z.string().trim().min(1).optional(),
    headSha: EntityRevisionSchema.optional(),
    currentUserFileSha: EntityRevisionSchema.nullable().optional(),
    revision: EntityRevisionSchema.optional(),
    canEdit: z.boolean(),
    updatedAt: z.iso.datetime({ offset: true }).optional(),
    profileKind: PublicProfileKindSchema.optional(),
    targetUserFile: z.string().trim().min(1).optional(),
    targetAggregateFiles: z.array(z.string().trim().min(1)).max(3).optional(),
    draftProfile: EditorRecordSchema.nullable().optional(),
  })
  .strict();

export const PublicProfileResponseSchema = z
  .object({
    profile: EditorRecordSchema.nullable(),
    profileKind: PublicProfileKindSchema.optional(),
    targetUserFile: z.string().trim().min(1).optional(),
    targetAggregateFiles: z.array(z.string().trim().min(1)).max(3).optional(),
  })
  .strict();

export const PublicProjectSchemaResponseSchema = z
  .object({
    canSubmitOwnedProjects: z.boolean(),
    canSubmitAnyProject: z.boolean(),
    identity: z
      .object({
        email: z.email(),
        username: z.string().trim().min(1),
        sNumber: z.string().trim().min(1).nullable(),
      })
      .strict(),
    lockedFields: LockedFieldsSchema,
    note: z.string().trim().min(1),
  })
  .strict();

export const PublicProjectPrSchema = z
  .object({
    status: EditorPullRequestStatusSchema,
    number: z.number().int().positive().optional(),
    url: z.url().optional(),
    branch: z.string().trim().min(1).optional(),
    headSha: EntityRevisionSchema.optional(),
    revision: EntityRevisionSchema.optional(),
    canEdit: z.boolean(),
    updatedAt: z.iso.datetime({ offset: true }).optional(),
    targetProjectFile: z.string().trim().min(1).optional(),
    targetAggregateFile: z.string().trim().min(1).optional(),
    targetManifestFile: z.string().trim().min(1).optional(),
    draftProject: EditorRecordSchema.nullable().optional(),
  })
  .strict();

export const PublicProjectResponseSchema = z
  .object({
    project: EditorRecordSchema.nullable(),
    revision: EntityRevisionSchema.optional(),
    targetProjectFile: z.string().trim().min(1).optional(),
    targetAggregateFile: z.string().trim().min(1).optional(),
    targetManifestFile: z.string().trim().min(1).optional(),
  })
  .strict();

export const PublicCourseSchemaResponseSchema = z
  .object({
    canEditCourses: z.boolean(),
    identity: z
      .object({
        email: z.email(),
        username: z.string().trim().min(1),
      })
      .strict(),
    lockedFields: LockedFieldsSchema,
    note: z.string().trim().min(1),
  })
  .strict();

export const PublicAcademicPrSchema = z
  .object({
    status: EditorPullRequestStatusSchema,
    number: z.number().int().positive().optional(),
    url: z.url().optional(),
    branch: z.string().trim().min(1).optional(),
    headSha: EntityRevisionSchema.optional(),
    revision: EntityRevisionSchema.optional(),
    canEdit: z.boolean(),
    updatedAt: z.iso.datetime({ offset: true }).optional(),
    targetRecordFile: z.string().trim().min(1).optional(),
    targetAggregateFile: z.string().trim().min(1).optional(),
    draftRecord: EditorRecordSchema.nullable().optional(),
  })
  .strict();

export type EditorPullRequestStatus = z.infer<
  typeof EditorPullRequestStatusSchema
>;
export type PublicProfileKind = z.infer<typeof PublicProfileKindSchema>;
export type StudentPlacementResponse = z.infer<
  typeof StudentPlacementResponseSchema
>;
export type PublicProfileSchemaResponse = z.infer<
  typeof PublicProfileSchemaResponseSchema
>;
export type PublicProfilePr = z.infer<typeof PublicProfilePrSchema>;
export type PublicProfileResponse = z.infer<typeof PublicProfileResponseSchema>;
export type PublicProjectSchemaResponse = z.infer<
  typeof PublicProjectSchemaResponseSchema
>;
export type PublicProjectPr = z.infer<typeof PublicProjectPrSchema>;
export type PublicProjectResponse = z.infer<typeof PublicProjectResponseSchema>;
export type PublicCourseSchemaResponse = z.infer<
  typeof PublicCourseSchemaResponseSchema
>;
export type PublicAcademicPr = z.infer<typeof PublicAcademicPrSchema>;
