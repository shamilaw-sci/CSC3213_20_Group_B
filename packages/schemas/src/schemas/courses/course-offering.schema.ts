import { z } from 'zod';

import { AcademicDepartmentCodeSchema } from '#schemas/academics/academic-organization.schema';
import { SemesterSchema } from '#schemas/academics/academic-period.schema';
import { AcademicYearSchema } from '#schemas/academics/academic-year.schema';
import { CourseIdSchema } from '#schemas/courses/course.schema';
import { CourseStaffSchema } from '#schemas/courses/course-staff.schema';
import { createKebabCaseIdSchema } from '#schemas/identifiers/kebab-case-id.schema';

export const CourseOfferingIdSchema = createKebabCaseIdSchema(
  'Invalid course offering id'
);

export type CourseOfferingId = z.infer<typeof CourseOfferingIdSchema>;

export const CourseOfferingSchema = z.object({
  id: CourseOfferingIdSchema,
  courseId: CourseIdSchema,
  academicYear: AcademicYearSchema,
  semester: SemesterSchema,
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
