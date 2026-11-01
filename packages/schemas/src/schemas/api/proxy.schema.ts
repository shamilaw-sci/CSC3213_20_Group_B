import { z } from 'zod';

const INVALID_PROXY_URL_MESSAGE = 'Enter a valid HTTPS proxy URL.';
const PROXY_USERNAME_PATTERN = /^[a-z0-9_-]{1,64}$/;

function isPublicHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (
    normalized.startsWith('[') ||
    /^\d+(?:\.\d+){3}$/.test(normalized) ||
    !normalized.includes('.')
  ) {
    return false;
  }

  return !['.home.arpa', '.internal', '.local', '.localhost'].some(
    (suffix) => normalized === suffix.slice(1) || normalized.endsWith(suffix)
  );
}

function isValidProxyUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    return false;
  }

  if (url.port !== '') {
    const port = Number(url.port);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) return false;
  }

  const hostname = url.hostname;
  if (hostname.length > 253 || !isPublicHostname(hostname)) return false;

  return hostname
    .split('.')
    .every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
    );
}

export const ProxyUrlSchema = z
  .string()
  .trim()
  .min(1, INVALID_PROXY_URL_MESSAGE)
  .max(2048, INVALID_PROXY_URL_MESSAGE)
  .refine(isValidProxyUrl, INVALID_PROXY_URL_MESSAGE);

export const ProxyUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(PROXY_USERNAME_PATTERN, 'Invalid proxy username.');

export const ProxyResolutionResponseSchema = z
  .object({ url: ProxyUrlSchema })
  .strict();

export const ProxyUpdateRequestSchema = z
  .object({
    email: z
      .string({ error: 'Enter a valid target email.' })
      .min(1, 'Enter a valid target email.')
      .optional(),
    active: z.boolean({ error: 'active must be a boolean.' }),
    url: ProxyUrlSchema,
  })
  .strict();

export type ProxyUpdateRequest = z.infer<typeof ProxyUpdateRequestSchema>;
export type ProxyResolutionResponse = z.infer<
  typeof ProxyResolutionResponseSchema
>;
