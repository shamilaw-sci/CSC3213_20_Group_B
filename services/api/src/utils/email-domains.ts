import { isUniversityEmailDomain } from '@scs/schemas';

export function isAllowedEmailDomain(email: string): boolean {
  return isUniversityEmailDomain(email);
}
