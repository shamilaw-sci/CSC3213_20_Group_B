import { z } from 'zod';

export const proxyUrlSchema = z
  .string()
  .trim()
  .min(1, 'Enter a proxy URL.')
  .max(2048, 'Proxy URL must be 2048 characters or fewer.')
  .superRefine((value, context) => {
    let url: URL;

    try {
      url = new URL(value);
    } catch {
      context.addIssue({
        code: 'custom',
        message:
          'Enter a valid URL, such as https://example.com:8080 or http://192.168.1.10:8080.',
      });
      return;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        message: 'Proxy URL must start with http:// or https://.',
      });
    }

    if (url.username || url.password) {
      context.addIssue({
        code: 'custom',
        message: 'Credentials are not allowed in the proxy URL.',
      });
    }
  });

export function getProxyUrlError(value: string) {
  const result = proxyUrlSchema.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message;
}
