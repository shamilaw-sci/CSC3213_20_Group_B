import { z } from 'zod';

import {
  AcademicDepartmentCodeSchema,
  AcademicUnitCodeSchema,
} from '../../../academics/academic-organization.schema';
import { PersonSchema } from '../../person.schema';
import { NonAcademicPositionSchema } from './non-academic-position.schema';

export const NonAcademicStaffSchema = PersonSchema.extend({
  staffType: z.literal('NON_ACADEMIC'),
  designation: NonAcademicPositionSchema,
  department: AcademicDepartmentCodeSchema.optional(),
  unit: AcademicUnitCodeSchema.optional(),
  officePhone: z.string().optional(),
});

export type NonAcademicStaff = z.infer<typeof NonAcademicStaffSchema>;
