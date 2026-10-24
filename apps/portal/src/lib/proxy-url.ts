import { ProxyUrlSchema } from '@scs/schemas';

export function getProxyUrlError(value: string) {
  const result = ProxyUrlSchema.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message;
}
