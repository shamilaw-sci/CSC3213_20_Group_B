import {
  SNumberSchema,
  STUDENT_EMAIL_DOMAIN,
  UniversityEmailDomainSchema,
} from '@scs/schemas';

export function isStudentLocalPart(value: string): boolean {
  return SNumberSchema.safeParse(value.toUpperCase()).success;
}

export function emailCompletion(value: string): string {
  if (!value || /\s/.test(value)) return '';

  const at = value.indexOf('@');
  if (at === -1) {
    return isStudentLocalPart(value) ? `@${STUDENT_EMAIL_DOMAIN}` : '';
  }
  if (at === 0 || value.indexOf('@', at + 1) !== -1) return '';

  const prefix = value.slice(at + 1).toLowerCase();
  if (!prefix) return '';

  const matches = UniversityEmailDomainSchema.options.filter((domain) =>
    domain.startsWith(prefix)
  );
  return matches.length === 1 ? matches[0]!.slice(prefix.length) : '';
}
