import { z } from 'zod';

import {
  AcademicDepartmentCodeSchema,
  AcademicUnitCodeSchema,
} from '#schemas/academics/academic-organization.schema';
import { PersonSchema } from '#schemas/people/person.schema';
import { SocialLinksSchema } from '#schemas/people/social-links.schema';
import { NonAcademicPositionSchema } from '#schemas/people/staff/non-academic/non-academic-position.schema';

export const NonAcademicStaffSchema = PersonSchema.extend({
  staffType: z.literal('NON_ACADEMIC'),
  designation: NonAcademicPositionSchema,
  department: AcademicDepartmentCodeSchema.optional(),
  unit: AcademicUnitCodeSchema.optional(),
  officePhone: z.string().optional(),
  socialLinks: SocialLinksSchema.optional(),
});

export type NonAcademicStaff = z.infer<typeof NonAcademicStaffSchema>;
