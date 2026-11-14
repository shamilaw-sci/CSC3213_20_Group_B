import { z } from 'zod';

import { AcademicDepartmentCodeSchema } from '#schemas/academics/academic-organization.schema';
import { CourseCodeSchema } from '#schemas/courses/course-code.schema';
import { createKebabCaseIdSchema } from '#schemas/identifiers/kebab-case-id.schema';

export const CourseIdSchema = createKebabCaseIdSchema('Invalid course id');

export type CourseId = z.infer<typeof CourseIdSchema>;

export const CourseSchema = z
  .object({
    id: CourseIdSchema,
    primaryCode: CourseCodeSchema,
    codes: z.array(CourseCodeSchema).min(1),
    title: z.string().trim().min(1),
    credits: z.number().int().min(0).max(10),
    nonGpa: z.boolean().optional(),
    departments: z.array(AcademicDepartmentCodeSchema).default([]),
  })
  .refine(
    (course) => course.codes.includes(course.primaryCode),
    'primaryCode must be listed in codes'
  )
  .refine(
    (course) => new Set(course.codes).size === course.codes.length,
    'codes must not contain duplicates'
  )
  .refine(
    (course) => new Set(course.departments).size === course.departments.length,
    'departments must not contain duplicates'
  );

export type Course = z.infer<typeof CourseSchema>;
