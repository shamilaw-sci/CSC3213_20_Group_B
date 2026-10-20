import {
  AcademicSupportStaffSchema,
  AcademicTeachingStaffSchema,
  CourseOfferingSchema,
  CourseSchema,
  EntityRevisionSchema,
  IdempotencyKeySchema,
  NonAcademicStaffSchema,
  ProjectSchema,
  StudentSchema,
} from '@scs/schemas';
import { z } from 'zod';

import { repositoryPermissionLevelSchema } from '@/schemas/user-access.schema';

const usernameSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z0-9-]{1,39}$/);

const repositorySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?$/);

const actorSchema = z.string().trim().min(1);
const dataRepoPathSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^public\/people\/v2\/[A-Za-z0-9/_-]+\.json$/);
const projectDataRepoPathSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^public\/projects\/v2\/[A-Za-z0-9/_-]+\.json$/);
const academicDataRepoPathSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^public\/academic\/v2\/[A-Za-z0-9/_-]+\.json$/);
const gitShaSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{40}$/i);

/**
 * Request body for granting or removing repository access.
 */
export const updateRepositoryPermissionRequestSchema = z.object({
  repository: repositorySchema,
  username: usernameSchema,
  updatedBy: actorSchema,
  permission: repositoryPermissionLevelSchema.default('read'),
  active: z.boolean(),
});

export const getPublicProfileQuerySchema = z.object({
  username: usernameSchema,
});

export const getPublicProjectQuerySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const academicRegistryIdSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const getPublicAcademicRecordQuerySchema = z.object({
  id: academicRegistryIdSchema,
});

const specialStreams = [
  'biomedical-science',
  'botany',
  'computer-science',
  'data-science',
  'geology',
  'mathematics',
  'microbiology',
  'molecular-biology',
  'physics',
  'statistics',
  'zoology',
  'applied-science',
  'statistics-and-operations-research',
] as const;
const PublicProfileStudentSchema = StudentSchema.passthrough();
const studentTrackSchema = z.enum(['GENERAL', 'HONOURS']);
const studentLevelSchema = z.enum(['1000', '2000', '3000', '4000']);
const postgraduateProgrammeSchema = z.enum([
  'POSTGRADUATE_CERTIFICATE',
  'POSTGRADUATE_DIPLOMA',
  'MASTERS_COURSEWORK',
  'MSC',
  'MPHIL',
  'MPHIL_UPGRADE_FROM_MSC',
  'PHD',
  'PHD_UPGRADE_FROM_MSC',
  'PHD_UPGRADE_FROM_MPHIL',
]);
const slqfLevelSchema = z.enum(['L7', 'L8', 'L9', 'L10', 'L11', 'L12']);

const studentPlacementSchema = z.object({
  batch: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^s\d{2}$/),
  studentTrack: studentTrackSchema,
  level: studentLevelSchema,
});
const alumniRuleSchema = z.object({
  batch: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^s\d{2}$/),
  studentTracks: z.array(studentTrackSchema).min(1).max(2),
});
const postgraduateProgrammeDefinitionSchema = z.object({
  programme: postgraduateProgrammeSchema,
  label: z.string().trim().min(1),
  slqfLevel: slqfLevelSchema,
});
const studentStreamDefinitionSchema = z.object({
  stream: z.enum(specialStreams),
  label: z.string().trim().min(1),
  directory: z.string().trim().min(1).optional(),
  publicDirectory: z.boolean(),
});

export const updateStudentPlacementMetadataRequestSchema = z
  .object({
    updatedBy: actorSchema,
    placement: z.array(studentPlacementSchema),
    alumni: z.array(alumniRuleSchema),
    postgraduateProgrammes: z.array(postgraduateProgrammeDefinitionSchema),
    studentStreams: z.array(studentStreamDefinitionSchema),
  })
  .refine(
    ({ alumni, placement }) => {
      const placementKeys = new Set(
        placement.map((rule) => `${rule.batch}:${rule.studentTrack}`)
      );
      return alumni.every((rule) =>
        rule.studentTracks.every((track) =>
          placementKeys.has(`${rule.batch}:${track}`)
        )
      );
    },
    {
      message: 'Alumni tracks must have matching placement rules',
      path: ['alumni'],
    }
  );

export const discardStudentPlacementMetadataRequestSchema = z.object({
  updatedBy: actorSchema,
});

const publicProfileRequestBaseSchema = z.object({
  username: usernameSchema,
  updatedBy: actorSchema,
  updatedByType: z.enum(['self', 'admin']).optional(),
  userPath: dataRepoPathSchema,
  aggregatePaths: z.array(dataRepoPathSchema).min(1).max(3),
  expectedUserFileSha: gitShaSchema.nullable().optional(),
  expectedPrHeadSha: gitShaSchema.optional(),
  expectedRevision: EntityRevisionSchema.optional(),
});

function usernameFromProfile(profile: {
  email?: string;
  registrationNo?: string;
}) {
  if (profile.registrationNo) return profile.registrationNo.toLowerCase();
  return profile.email?.split('@')[0].toLowerCase() ?? '';
}

function batchFromRegistrationNo(registrationNo: string): string | null {
  const match = /^S(\d{2})(SP)?\d{3}$/i.exec(registrationNo);
  return match ? `s${match[1]}` : null;
}

function departmentStaffAggregatePath(
  profile: Record<string, unknown>,
  staffKind: 'academic' | 'academic-support' | 'non-academic'
) {
  if (typeof profile.department !== 'string' || !profile.department.trim()) {
    return null;
  }

  const department = profile.department
    .trim()
    .toLowerCase()
    .replaceAll('_', '-');
  return `public/people/v2/staff/${department}/${staffKind}.json`;
}

function samePaths(left: string[], right: string[]) {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return (
    left.length === right.length &&
    sortedLeft.every((path, index) => path === sortedRight[index])
  );
}

export const updatePublicProfileRequestSchema = z
  .discriminatedUnion('profileKind', [
    publicProfileRequestBaseSchema.extend({
      profileKind: z.literal('academic'),
      profile: AcademicTeachingStaffSchema,
    }),
    publicProfileRequestBaseSchema.extend({
      profileKind: z.literal('academic-support'),
      profile: AcademicSupportStaffSchema,
    }),
    publicProfileRequestBaseSchema.extend({
      profileKind: z.literal('non-academic'),
      profile: NonAcademicStaffSchema,
    }),
    publicProfileRequestBaseSchema.extend({
      profileKind: z.literal('student'),
      profile: PublicProfileStudentSchema,
    }),
  ])
  .superRefine((value, ctx) => {
    const username = usernameFromProfile(value.profile);
    const expectedUserPath = `public/people/v2/users/${value.username.toLowerCase()}.json`;

    if (!username || username !== value.username.toLowerCase()) {
      ctx.addIssue({
        code: 'custom',
        path: ['username'],
        message: 'Username must match profile identity',
      });
    }

    if (value.userPath !== expectedUserPath) {
      ctx.addIssue({
        code: 'custom',
        path: ['userPath'],
        message: 'User path must match username',
      });
    }

    const expectedAggregatePaths: string[] = [];
    if (value.profileKind === 'academic') {
      expectedAggregatePaths.push('public/people/v2/staff/academic.json');
      const departmentPath = departmentStaffAggregatePath(
        value.profile,
        'academic'
      );
      if (departmentPath) expectedAggregatePaths.push(departmentPath);
    } else if (value.profileKind === 'academic-support') {
      expectedAggregatePaths.push(
        'public/people/v2/staff/academic-support.json'
      );
      const departmentPath = departmentStaffAggregatePath(
        value.profile,
        'academic-support'
      );
      if (departmentPath) expectedAggregatePaths.push(departmentPath);
    } else if (value.profileKind === 'non-academic') {
      expectedAggregatePaths.push('public/people/v2/staff/non-academic.json');
      const departmentPath = departmentStaffAggregatePath(
        value.profile,
        'non-academic'
      );
      if (departmentPath) expectedAggregatePaths.push(departmentPath);
    } else {
      const batch = batchFromRegistrationNo(value.profile.registrationNo);
      if (batch) {
        expectedAggregatePaths.push(`public/people/v2/students/${batch}.json`);
        if (value.profile.studentTrack === 'HONOURS') {
          const specialPath = value.aggregatePaths.find((path) =>
            path.startsWith('public/people/v2/special/')
          );
          const specialMatch = specialPath
            ? /^public\/people\/v2\/special\/([^/]+)\/(s\d{2})\.json$/.exec(
                specialPath
              )
            : null;
          if (specialMatch) {
            const [, stream, specialBatch] = specialMatch;
            if (
              stream &&
              specialBatch &&
              specialStreams.includes(
                stream as (typeof specialStreams)[number]
              ) &&
              specialBatch === batch &&
              specialPath
            ) {
              expectedAggregatePaths.push(specialPath);
            }
          }
        }
      }
    }

    if (!samePaths(value.aggregatePaths, expectedAggregatePaths)) {
      ctx.addIssue({
        code: 'custom',
        path: ['aggregatePaths'],
        message: 'Aggregate paths must match profile kind and identity',
      });
    }
  });

export const submitPublicProfileOperationRequestSchema = z
  .object({
    request: updatePublicProfileRequestSchema,
    actorSubjectId: z
      .string()
      .trim()
      .min(16)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
    idempotencyKey: IdempotencyKeySchema,
    correlationId: z.string().trim().min(8).max(128),
  })
  .strict();

export const discardPublicProfilePrRequestSchema = z.object({
  username: usernameSchema,
  updatedBy: actorSchema,
  prNumber: z.number().int().positive(),
  expectedHeadSha: gitShaSchema,
  reason: z.string().trim().min(1).max(500),
});

export const updatePublicProjectRequestSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    updatedBy: actorSchema,
    updatedByType: z.enum(['owner', 'admin']).optional(),
    projectPath: projectDataRepoPathSchema,
    aggregatePath: z.literal('public/projects/v2/projects.json'),
    manifestPath: z.literal('public/projects/v2/manifest.json'),
    project: ProjectSchema,
    expectedHeadSha: gitShaSchema.optional(),
    expectedRevision: EntityRevisionSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const expectedProjectPath = `public/projects/v2/projects/${value.slug}.json`;

    if (value.project.slug !== value.slug) {
      ctx.addIssue({
        code: 'custom',
        path: ['slug'],
        message: 'Slug must match project slug',
      });
    }

    if (value.projectPath !== expectedProjectPath) {
      ctx.addIssue({
        code: 'custom',
        path: ['projectPath'],
        message: 'Project path must match slug',
      });
    }
  });

export const deletePublicProjectRequestSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    updatedBy: actorSchema,
    updatedByType: z.literal('admin').optional(),
    projectPath: projectDataRepoPathSchema,
    aggregatePath: z.literal('public/projects/v2/projects.json'),
    manifestPath: z.literal('public/projects/v2/manifest.json'),
    expectedHeadSha: gitShaSchema.optional(),
    expectedRevision: EntityRevisionSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const expectedProjectPath = `public/projects/v2/projects/${value.slug}.json`;

    if (value.projectPath !== expectedProjectPath) {
      ctx.addIssue({
        code: 'custom',
        path: ['projectPath'],
        message: 'Project path must match slug',
      });
    }
  });

const projectOperationEnvelopeSchema = z.object({
  actorSubjectId: z
    .string()
    .trim()
    .min(16)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
  idempotencyKey: IdempotencyKeySchema,
  correlationId: z.string().trim().min(8).max(128),
});

export const submitPublicProjectOperationRequestSchema = z.discriminatedUnion(
  'action',
  [
    projectOperationEnvelopeSchema.extend({
      action: z.literal('upsert'),
      request: updatePublicProjectRequestSchema,
    }),
    projectOperationEnvelopeSchema.extend({
      action: z.literal('delete'),
      request: deletePublicProjectRequestSchema,
    }),
  ]
);

export const updatePublicCourseRequestSchema = z
  .object({
    id: academicRegistryIdSchema,
    updatedBy: actorSchema,
    recordPath: academicDataRepoPathSchema,
    aggregatePath: z.literal('public/academic/v2/courses.json'),
    course: CourseSchema,
    expectedHeadSha: gitShaSchema.optional(),
    expectedRevision: EntityRevisionSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const expectedRecordPath = `public/academic/v2/courses/${value.id}.json`;

    if (value.course.id !== value.id) {
      ctx.addIssue({
        code: 'custom',
        path: ['id'],
        message: 'Course id must match record id',
      });
    }

    if (value.recordPath !== expectedRecordPath) {
      ctx.addIssue({
        code: 'custom',
        path: ['recordPath'],
        message: 'Course path must match id',
      });
    }
  });

export const deletePublicCourseRequestSchema = z
  .object({
    id: academicRegistryIdSchema,
    updatedBy: actorSchema,
    recordPath: academicDataRepoPathSchema,
    aggregatePath: z.literal('public/academic/v2/courses.json'),
    expectedHeadSha: gitShaSchema.optional(),
    expectedRevision: EntityRevisionSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const expectedRecordPath = `public/academic/v2/courses/${value.id}.json`;

    if (value.recordPath !== expectedRecordPath) {
      ctx.addIssue({
        code: 'custom',
        path: ['recordPath'],
        message: 'Course path must match id',
      });
    }
  });

export const updatePublicCourseOfferingRequestSchema = z
  .object({
    id: academicRegistryIdSchema,
    updatedBy: actorSchema,
    recordPath: academicDataRepoPathSchema,
    aggregatePath: z.literal('public/academic/v2/offerings.json'),
    offering: CourseOfferingSchema,
    expectedHeadSha: gitShaSchema.optional(),
    expectedRevision: EntityRevisionSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const expectedRecordPath = `public/academic/v2/offerings/${value.id}.json`;

    if (value.offering.id !== value.id) {
      ctx.addIssue({
        code: 'custom',
        path: ['id'],
        message: 'Offering id must match record id',
      });
    }

    if (value.recordPath !== expectedRecordPath) {
      ctx.addIssue({
        code: 'custom',
        path: ['recordPath'],
        message: 'Offering path must match id',
      });
    }
  });

export const deletePublicCourseOfferingRequestSchema = z
  .object({
    id: academicRegistryIdSchema,
    updatedBy: actorSchema,
    recordPath: academicDataRepoPathSchema,
    aggregatePath: z.literal('public/academic/v2/offerings.json'),
    expectedHeadSha: gitShaSchema.optional(),
    expectedRevision: EntityRevisionSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const expectedRecordPath = `public/academic/v2/offerings/${value.id}.json`;

    if (value.recordPath !== expectedRecordPath) {
      ctx.addIssue({
        code: 'custom',
        path: ['recordPath'],
        message: 'Offering path must match id',
      });
    }
  });

const academicOperationEnvelopeSchema = z.object({
  actorSubjectId: z
    .string()
    .trim()
    .min(16)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
  idempotencyKey: IdempotencyKeySchema,
  correlationId: z.string().trim().min(8).max(128),
});

export const submitPublicAcademicOperationRequestSchema = z.discriminatedUnion(
  'operation',
  [
    academicOperationEnvelopeSchema.extend({
      operation: z.literal('course.upsert'),
      request: updatePublicCourseRequestSchema,
    }),
    academicOperationEnvelopeSchema.extend({
      operation: z.literal('course.delete'),
      request: deletePublicCourseRequestSchema,
    }),
    academicOperationEnvelopeSchema.extend({
      operation: z.literal('offering.upsert'),
      request: updatePublicCourseOfferingRequestSchema,
    }),
    academicOperationEnvelopeSchema.extend({
      operation: z.literal('offering.delete'),
      request: deletePublicCourseOfferingRequestSchema,
    }),
  ]
);
