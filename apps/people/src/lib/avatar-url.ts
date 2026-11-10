import type { Staff, Student } from '@scs/schemas';

import publicEnvConfig from '@/config/public.env.config';

export function avatarUrlForPerson(
  person: Staff | Student
): string | undefined {
  const username =
    'registrationNo' in person
      ? person.registrationNo.toLowerCase()
      : person.email?.split('@')[0]?.toLowerCase();
  if (!username || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(username))
    return undefined;
  return `${publicEnvConfig.NEXT_PUBLIC_API_BASE_URL}/api/people/v2/avatars/${username}`;
}
