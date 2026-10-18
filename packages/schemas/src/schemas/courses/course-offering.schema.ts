import { z } from 'zod';

import { AcademicDepartmentCodeSchema } from '../academics/academic-organization.schema';
import { AcademicYearSchema } from '../academics/academic-year.schema';
import { CourseIdSchema } from './course.schema';
import { CourseStaffSchema } from './course-staff.schema';

export const CourseOfferingIdSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid course offering id');

export type CourseOfferingId = z.infer<typeof CourseOfferingIdSchema>;

export const CourseOfferingSchema = z.object({
  id: CourseOfferingIdSchema,
  courseId: CourseIdSchema,
  academicYear: AcademicYearSchema,
  semester: z.enum(['SEM1', 'SEM2']),
  staff: z.array(CourseStaffSchema),
  departments: z
    .array(AcademicDepartmentCodeSchema)
    .default([])
    .refine(
      (departments) => new Set(departments).size === departments.length,
      'departments must not contain duplicates'
    ),
});

export type CourseOffering = z.infer<typeof CourseOfferingSchema>;
