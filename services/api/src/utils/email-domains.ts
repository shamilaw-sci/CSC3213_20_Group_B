import { ALLOWED_GOOGLE_WORKSPACES_DOMAINS } from '@/config/client.config';

const normalizedAllowedDomains = ALLOWED_GOOGLE_WORKSPACES_DOMAINS.map((d) =>
  d.toLowerCase()
);

export function isAllowedEmailDomain(email: string): boolean {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) return false;
  const domain = email.slice(atIndex + 1).toLowerCase();
  return normalizedAllowedDomains.includes(domain);
}
