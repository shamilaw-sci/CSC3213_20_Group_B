import { z } from 'zod';

/** A valid checksum does not establish ownership of an ORCID record. */
export function normalizeOrcidIdentifier(value: string): string | null {
  const input = value.trim();
  let identifier = input;
  if (input.includes('://') || input.toLowerCase().startsWith('orcid.org/')) {
    const candidate = input.includes('://') ? input : `https://${input}`;
    if (!URL.canParse(candidate)) return null;
    const url = new URL(candidate);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'orcid.org' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    identifier = url.pathname.slice(1).replace(/\/$/, '');
  }
  const canonical = identifier.toUpperCase();
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(canonical)) return null;
  const digits = canonical.replace(/-/g, '');
  let total = 0;
  for (const digit of digits.slice(0, 15)) total = (total + Number(digit)) * 2;
  const check = (12 - (total % 11)) % 11;
  return digits[15] === (check === 10 ? 'X' : String(check)) ? canonical : null;
}

export const OrcidIdentifierSchema = z.string().transform((value, ctx) => {
  const identifier = normalizeOrcidIdentifier(value);
  if (identifier) return identifier;
  ctx.addIssue({ code: 'custom', message: 'Invalid ORCID identifier' });
  return z.NEVER;
});

export const OrcidUrlSchema = OrcidIdentifierSchema.transform(
  (identifier) => `https://orcid.org/${identifier}`
);
