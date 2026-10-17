import { ERROR_REDIRECT_URLS } from '@/config/client.config';

export function redirectError(clientId: string, error: string): Response {
  const redirectUrl = ERROR_REDIRECT_URLS[clientId];

  if (!redirectUrl) {
    return new Response('Invalid client', { status: 400 });
  }

  const url = new URL(redirectUrl);
  url.searchParams.set('error', error);

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
    },
  });
}
