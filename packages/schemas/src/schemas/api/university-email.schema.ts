import { z } from 'zod';

export const STUDENT_EMAIL_DOMAIN = 'sci.pdn.ac.lk';
export const UniversityEmailDomainSchema = z.enum([
  STUDENT_EMAIL_DOMAIN,
  'pdn.ac.lk',
]);

export function isUniversityEmailDomain(email: string): boolean {
  const at = email.indexOf('@');
  return (
    at > 0 &&
    at === email.lastIndexOf('@') &&
    UniversityEmailDomainSchema.safeParse(email.slice(at + 1).toLowerCase())
      .success
  );
}
