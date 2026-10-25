import { expect, test } from 'bun:test';

import { getStaffTypeLabel } from '@/lib/types';

test('turns staff type codes into reader-facing category labels', () => {
  expect(getStaffTypeLabel('ACADEMIC_TEACHING')).toBe(
    'Academic Teaching Staff'
  );
  expect(getStaffTypeLabel('ACADEMIC_SUPPORT')).toBe('Academic Support Staff');
  expect(getStaffTypeLabel('NON_ACADEMIC')).toBe('Non-Academic Staff');
});
