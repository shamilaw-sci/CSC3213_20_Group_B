import { z } from 'zod';

export const SECURITY_TXT_CANONICAL_URL =
  'https://portal.scs-pdn.space/.well-known/security.txt';

const lineValueSchema = z
  .string()
  .min(1)
  .refine((value) => !/[\r\n]/u.test(value), 'Must not contain CR or LF');

function uriSchema(schemes: readonly string[]) {
  return lineValueSchema.refine(
    (value) => {
      try {
        return schemes.includes(new URL(value).protocol.slice(0, -1));
      } catch {
        return false;
      }
    },
    `Must use one of these URI schemes: ${schemes.join(', ')}`
  );
}

const httpsUriSchema = uriSchema(['https']);
const contactUriSchema = uriSchema(['https', 'mailto', 'tel']);
const encryptionUriSchema = uriSchema(['https', 'dns', 'openpgp4fpr']);

const languageTagSchema = lineValueSchema.transform((value, context) => {
  try {
    const [canonical] = Intl.getCanonicalLocales(value);
    if (canonical) return canonical;
  } catch {
    // The issue below keeps the validation error inside the Zod boundary.
  }

  context.addIssue({
    code: 'custom',
    message: 'Must be a language tag accepted by Intl.getCanonicalLocales()',
  });
  return z.NEVER;
});

const baseSecurityTxtConfigSchema = z
  .object({
    contact: z.array(contactUriSchema).min(1),
    expires: lineValueSchema.pipe(z.iso.datetime({ offset: true })),
    canonical: z.array(httpsUriSchema).min(1).optional(),
    policy: z.array(httpsUriSchema).min(1).optional(),
    encryption: z.array(encryptionUriSchema).min(1).optional(),
    acknowledgments: z.array(httpsUriSchema).min(1).optional(),
    hiring: z.array(httpsUriSchema).min(1).optional(),
    preferredLanguages: z.array(languageTagSchema).min(1).optional(),
  })
  .strict();

function securityTxtConfigSchema(now: () => Date) {
  return baseSecurityTxtConfigSchema.superRefine((configuration, context) => {
    if (new Date(configuration.expires).getTime() <= now().getTime()) {
      context.addIssue({
        code: 'custom',
        path: ['expires'],
        message: 'Expires must be in the future',
      });
    }
  });
}

export const SecurityTxtConfigSchema = securityTxtConfigSchema(
  () => new Date()
);

export type SecurityTxtConfig = z.input<typeof baseSecurityTxtConfigSchema>;

const repeatedFields = [
  ['Canonical', 'canonical'],
  ['Policy', 'policy'],
  ['Encryption', 'encryption'],
  ['Acknowledgments', 'acknowledgments'],
  ['Hiring', 'hiring'],
] as const;

export function generateSecurityTxt(
  configuration: SecurityTxtConfig,
  now = new Date()
): string {
  const parsed = securityTxtConfigSchema(() => now).parse(configuration);
  const lines = [
    ...parsed.contact.map((value) => `Contact: ${value}`),
    `Expires: ${parsed.expires}`,
  ];

  for (const [field, key] of repeatedFields) {
    for (const value of parsed[key] ?? []) {
      lines.push(`${field}: ${value}`);
    }
  }

  if (parsed.preferredLanguages) {
    lines.push(`Preferred-Languages: ${parsed.preferredLanguages.join(', ')}`);
  }

  return `${lines.join('\n')}\n`;
}

export function isSecurityTxtPath(pathname: string): boolean {
  const normalizedPath = pathname.toLowerCase();
  return (
    normalizedPath === '/security.txt' ||
    normalizedPath === '/.well-known/security.txt'
  );
}

export function getSecurityTxtRedirectTarget(request: {
  method: string;
  url: string;
}): string | undefined {
  if (request.method !== 'GET' && request.method !== 'HEAD') return;

  const requestUrl = new URL(request.url);
  if (!isSecurityTxtPath(requestUrl.pathname)) return;

  const canonicalUrl = new URL(SECURITY_TXT_CANONICAL_URL);
  if (
    requestUrl.origin === canonicalUrl.origin &&
    requestUrl.pathname === canonicalUrl.pathname
  ) {
    return;
  }

  return SECURITY_TXT_CANONICAL_URL;
}
