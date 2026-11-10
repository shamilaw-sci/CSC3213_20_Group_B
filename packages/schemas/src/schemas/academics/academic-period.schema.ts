import { z } from 'zod';

import { AcademicYearSchema } from '#schemas/academics/academic-year.schema';

export const SemesterSchema = z.enum(['SEM1', 'SEM2']);

export type Semester = z.infer<typeof SemesterSchema>;

export const AcademicPeriodSchema = z.object({
  year: AcademicYearSchema,
  semester: SemesterSchema,
});

export type AcademicPeriod = z.infer<typeof AcademicPeriodSchema>;
