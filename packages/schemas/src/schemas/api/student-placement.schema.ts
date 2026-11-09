import { z } from 'zod';

import { EntityRevisionSchema } from '#schemas/api/mutation.schema';
import {
  AlumniBatchSchema,
  PostgraduateProgrammeDefinitionSchema,
  StudentPlacementSchema,
  StudentStreamDefinitionSchema,
} from '#schemas/people/students/student.schema';

export const StudentPlacementMetadataSchema = z
  .object({
    placement: z.array(StudentPlacementSchema),
    alumni: z.array(AlumniBatchSchema),
    postgraduateProgrammes: z.array(PostgraduateProgrammeDefinitionSchema),
    studentStreams: z.array(StudentStreamDefinitionSchema),
  })
  .strict();

export const StudentPlacementPrStatusSchema = z.enum([
  'none',
  'open',
  'merged',
  'closed',
]);

export const StudentPlacementPrSchema = z
  .object({
    status: StudentPlacementPrStatusSchema,
    number: z.number().int().positive().optional(),
    url: z.url().optional(),
    branch: z.string().trim().min(1).optional(),
    headSha: EntityRevisionSchema.optional(),
    canEdit: z.boolean(),
    updatedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export type StudentPlacementMetadata = z.infer<
  typeof StudentPlacementMetadataSchema
>;
export type StudentPlacementPrStatus = z.infer<
  typeof StudentPlacementPrStatusSchema
>;
export type StudentPlacementPr = z.infer<typeof StudentPlacementPrSchema>;
