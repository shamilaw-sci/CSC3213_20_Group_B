import { z } from 'zod';

const INVALID_PROXY_URL_MESSAGE = 'Enter a valid HTTP or HTTPS proxy URL.';

function isValidProxyUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username !== '' ||
    url.password !== ''
  ) {
    return false;
  }

  if (url.port !== '') {
    const port = Number(url.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
  }

  const hostname = url.hostname;
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true;

  if (/^\d+(?:\.\d+){3}$/.test(hostname)) return true;

  if (hostname.length > 253) return false;
  return hostname
    .split('.')
    .every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
    );
}

const proxyUrlSchema = z
  .string()
  .trim()
  .min(1, INVALID_PROXY_URL_MESSAGE)
  .max(2048, INVALID_PROXY_URL_MESSAGE)
  .refine(isValidProxyUrl, INVALID_PROXY_URL_MESSAGE);

export const proxyUpdateRequestSchema = z
  .object({
    email: z
      .string({ error: 'Enter a valid target email.' })
      .min(1, 'Enter a valid target email.')
      .optional(),
    active: z.boolean({ error: 'active must be a boolean.' }).optional(),
    url: proxyUrlSchema.optional(),
  })
  .strict();

export type ProxyUpdateRequestDto = z.infer<typeof proxyUpdateRequestSchema>;
