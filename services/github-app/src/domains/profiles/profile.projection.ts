import type {
  ProfileKind,
  PublicProfile,
} from '@/domains/profiles/profile.types';

function normalizedStrings(values: Array<string | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))
    ),
  ];
}

export function profileIdentity(
  profile: PublicProfile | Record<string, unknown>
): string {
  const registrationNo =
    'registrationNo' in profile ? profile.registrationNo : undefined;
  if (typeof registrationNo === 'string' && registrationNo.trim()) {
    return registrationNo.trim().toLowerCase();
  }

  const email = profile.email;
  if (typeof email === 'string' && email.includes('@')) {
    return email.split('@')[0]?.toLowerCase() ?? '';
  }
  return '';
}

export function inferProfileKind(
  profile: Record<string, unknown> | null
): ProfileKind | undefined {
  if (profile?.staffType === 'ACADEMIC_TEACHING') return 'academic';
  if (profile?.staffType === 'ACADEMIC_SUPPORT') return 'academic-support';
  if (profile?.staffType === 'NON_ACADEMIC') return 'non-academic';
  if (typeof profile?.registrationNo === 'string') return 'student';
  return undefined;
}

function searchSubtitle(
  profileKind: ProfileKind,
  profile: Record<string, unknown>
): string {
  if (profileKind === 'academic') return 'Academic Staff';
  if (profileKind === 'academic-support') return 'Academic Support Staff';
  if (profileKind === 'non-academic') return 'Non-Academic Staff';
  return profile.status === 'ALUMNI' ? 'Alumni' : 'Student';
}

export function searchEntryForProfile(profile: Record<string, unknown>) {
  const identity = profileIdentity(profile);
  const profileKind = inferProfileKind(profile);
  if (!identity || !profileKind) return null;

  const title = typeof profile.title === 'string' ? profile.title : '';
  const fullName = typeof profile.fullName === 'string' ? profile.fullName : '';
  const name = [title, fullName].filter(Boolean).join(' ').trim() || fullName;
  const email = typeof profile.email === 'string' ? profile.email : undefined;
  const personalEmail =
    typeof profile.personalEmail === 'string'
      ? profile.personalEmail
      : undefined;
  const type = profileKind === 'student' ? 'STUDENT' : 'STAFF';

  return {
    id: `${type.toLowerCase()}:${identity}`,
    type,
    identity,
    href: `/people/${identity}`,
    name,
    subtitle: searchSubtitle(profileKind, profile),
    ...(email ? { email } : {}),
    keywords: normalizedStrings([
      identity,
      fullName,
      name,
      email,
      email?.split('@')[0],
      personalEmail,
      typeof profile.registrationNo === 'string'
        ? profile.registrationNo
        : undefined,
    ]),
  };
}

export function projectProfileMembership(
  currentValue: unknown,
  profile: PublicProfile
): Record<string, unknown>[] {
  const current = Array.isArray(currentValue)
    ? currentValue.filter(
        (record): record is Record<string, unknown> =>
          Boolean(record) &&
          typeof record === 'object' &&
          !Array.isArray(record)
      )
    : [];
  const identity = profileIdentity(profile);
  let replaced = false;
  const projected = current.map((record) => {
    if (profileIdentity(record) !== identity) return record;
    replaced = true;
    return profile;
  });
  if (!replaced) projected.push(profile);
  return projected;
}

export function removeProfileMembership(
  currentValue: unknown,
  identityValue: string
): Record<string, unknown>[] {
  const identity = identityValue.trim().toLowerCase();
  return (Array.isArray(currentValue) ? currentValue : []).filter(
    (record): record is Record<string, unknown> =>
      Boolean(record) &&
      typeof record === 'object' &&
      !Array.isArray(record) &&
      profileIdentity(record as Record<string, unknown>) !== identity
  );
}
