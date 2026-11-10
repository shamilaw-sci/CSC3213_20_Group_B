import { z } from 'zod';

import { AcademicDepartmentCodeSchema } from '#schemas/academics/academic-organization.schema';
import { SemesterSchema } from '#schemas/academics/academic-period.schema';
import { AcademicYearSchema } from '#schemas/academics/academic-year.schema';
import { CourseIdSchema } from '#schemas/courses/course.schema';
import { CourseCodeSchema } from '#schemas/courses/course-code.schema';
import { CourseOfferingIdSchema } from '#schemas/courses/course-offering.schema';
import { createKebabCaseIdSchema } from '#schemas/identifiers/kebab-case-id.schema';
import { AcademicUsernameSchema } from '#schemas/people/identifiers/academic-username.schema';
import { SNumberSchema } from '#schemas/people/identifiers/s-number.schema';

export const ProjectSlugSchema = createKebabCaseIdSchema(
  'Invalid project slug'
);

export type ProjectSlug = z.infer<typeof ProjectSlugSchema>;

export const ProjectTypeSchema = z.enum([
  'COURSE_PROJECT',
  'RESEARCH_PROJECT',
  'STUDENT_INNOVATION',
  'OPEN_SOURCE',
  'DEPARTMENT_SYSTEM',
  'DATASET',
  'PUBLICATION_ARTIFACT',
  'INDUSTRY_COLLABORATION',
  'FACULTY_COLLABORATION',
  'HACKATHON',
  'OTHER',
]);

export type ProjectType = z.infer<typeof ProjectTypeSchema>;

export const ProjectStatusSchema = z.enum([
  'PLANNED',
  'ACTIVE',
  'COMPLETED',
  'ARCHIVED',
]);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectPersonRoleSchema = z.enum([
  'student',
  'supervisor',
  'instructor',
  'maintainer',
  'collaborator',
  'contributor',
]);

export type ProjectPersonRole = z.infer<typeof ProjectPersonRoleSchema>;

export const ProjectPersonSchema = z.object({
  name: z.string().trim().min(1),
  role: ProjectPersonRoleSchema,
  username: AcademicUsernameSchema.optional(),
  email: z.email().optional(),
  sNumber: SNumberSchema.optional(),
});

export type ProjectPerson = z.infer<typeof ProjectPersonSchema>;

export const ProjectLinksSchema = z.object({
  repository: z.url().optional(),
  website: z.url().optional(),
  documentation: z.url().optional(),
  demo: z.url().optional(),
  dataset: z.url().optional(),
  publication: z.url().optional(),
  video: z.url().optional(),
});

export type ProjectLinks = z.infer<typeof ProjectLinksSchema>;

export const ProjectSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('TEMPLATE_INDEX_JSON'),
    repositoryName: z.string().trim().min(1),
    repositoryOwner: z.string().trim().min(1),
    metadataPath: z.string().trim().min(1),
    indexUrl: z.url().optional(),
  }),
  z.object({
    kind: z.literal('MANUAL'),
    curator: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal('GITHUB_REPO'),
    repositoryName: z.string().trim().min(1),
    repositoryOwner: z.string().trim().min(1),
  }),
]);

export type ProjectSource = z.infer<typeof ProjectSourceSchema>;

export const ProjectMediaSchema = z.object({
  icon: z.string().trim().min(1).default('FolderKanban'),
  coverImage: z.url().optional(),
});

export type ProjectMedia = z.infer<typeof ProjectMediaSchema>;

export const ProjectDatesSchema = z
  .object({
    startedAt: z.iso.date().optional(),
    completedAt: z.iso.date().optional(),
    lastUpdatedAt: z.iso.date(),
  })
  .refine(
    (dates) =>
      !dates.completedAt ||
      !dates.startedAt ||
      dates.completedAt >= dates.startedAt,
    'completedAt must be the same as or after startedAt'
  );

export type ProjectDates = z.infer<typeof ProjectDatesSchema>;

export const ProjectCourseSchema = z.object({
  courseId: CourseIdSchema.optional(),
  offeringId: CourseOfferingIdSchema.optional(),
  code: CourseCodeSchema,
  title: z.string().trim().min(1),
  academicYear: AcademicYearSchema.optional(),
  semester: SemesterSchema.optional(),
  departments: z
    .array(AcademicDepartmentCodeSchema)
    .default([])
    .refine(
      (departments) => new Set(departments).size === departments.length,
      'departments must not contain duplicates'
    ),
});

export type ProjectCourse = z.infer<typeof ProjectCourseSchema>;

export const ProjectCourseOfferingSchema = z.object({
  id: CourseOfferingIdSchema,
});

export type ProjectCourseOffering = z.infer<typeof ProjectCourseOfferingSchema>;

const ProjectFieldsSchema = z.object({
  id: z.string().trim().min(1),
  slug: ProjectSlugSchema,
  title: z.string().trim().min(1),
  shortDescription: z.string().trim().min(1),
  description: z.string().trim().min(1),
  projectType: ProjectTypeSchema,
  status: ProjectStatusSchema,
  categories: z.array(z.string().trim().min(1)).min(1),
  tags: z.array(z.string().trim().min(1)).default([]),
  departments: z
    .array(AcademicDepartmentCodeSchema)
    .default([])
    .refine(
      (departments) => new Set(departments).size === departments.length,
      'departments must not contain duplicates'
    ),
  academicYear: AcademicYearSchema.optional(),
  course: ProjectCourseSchema.optional(),
  courseOffering: ProjectCourseOfferingSchema.optional(),
  batch: z.string().trim().min(1).optional(),
  groupNumber: z.string().trim().min(1).optional(),
  people: z.array(ProjectPersonSchema).min(1),
  links: ProjectLinksSchema.default({}),
  source: ProjectSourceSchema,
  media: ProjectMediaSchema,
  dates: ProjectDatesSchema,
});

export const ProjectIndexSchemaUrl =
  'https://api.scs-pdn.space/api/projects/v2/schemas/index.json';

/** A repository index is a partial project; the registry alone owns ID and slug. */
export const ProjectIndexSchema = ProjectFieldsSchema.omit({
  id: true,
  slug: true,
})
  .partial()
  .extend({
    $schema: z.literal(ProjectIndexSchemaUrl).optional(),
    course: ProjectCourseSchema.partial().optional(),
    courseOffering: ProjectCourseOfferingSchema.partial().optional(),
    dates: z
      .object({
        startedAt: z.iso.date().optional(),
        completedAt: z.iso.date().optional(),
        lastUpdatedAt: z.iso.date().optional(),
      })
      .strict()
      .optional(),
    media: ProjectMediaSchema.partial().optional(),
  })
  .strict();

export type ProjectIndex = z.infer<typeof ProjectIndexSchema>;

export const ProjectIndexJsonSchema = {
  ...z.toJSONSchema(ProjectIndexSchema, { target: 'draft-2020-12' }),
  $id: ProjectIndexSchemaUrl,
  title: 'SCS PDN project repository index',
  description:
    'Optional project fields supplied by .docs/index.json. ID and slug are registry-owned.',
};

/** Published by-person entries are summaries and may carry additional project fields. */
export const ProjectSummarySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    shortDescription: z.string(),
  })
  .passthrough();

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

export const ProjectSchema = ProjectFieldsSchema.refine(
  (project) =>
    project.projectType !== 'COURSE_PROJECT' || !!project.course?.courseId,
  'course.courseId is required for COURSE_PROJECT'
);

export type Project = z.infer<typeof ProjectSchema>;

export function projectSlugBaseFromTitle(title: string): string {
  return (
    title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '')
      .slice(0, 90)
      .replace(/-+$/g, '') || 'project'
  );
}
