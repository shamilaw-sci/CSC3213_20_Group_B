import { isIP } from 'node:net';

/** Only the configured proxy socket may supply a client address. */
export function trustedClientHeaders(
  incoming: Headers,
  peerAddress: string | undefined,
  trustedProxyIp: string | undefined
): Headers | null {
  if (!peerAddress || isIP(peerAddress) === 0) return null;
  if (trustedProxyIp && peerAddress !== trustedProxyIp) return null;

  const headers = new Headers(incoming);
  const forwarded = headers.get('x-scs-client-ip');
  headers.delete('cf-connecting-ip');
  headers.delete('x-scs-client-ip');

  const clientIp = trustedProxyIp ? forwarded : peerAddress;
  if (!clientIp || isIP(clientIp) === 0) return null;
  headers.set('cf-connecting-ip', clientIp);
  return headers;
}
