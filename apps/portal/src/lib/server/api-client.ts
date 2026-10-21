import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { apiHeaders, readApiError } from '@/lib/api';

class PortalApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'PortalApiError';
  }
}

function serializeCookies(
  values: Array<{ name: string; value: string }>
): string {
  return values.map(({ name, value }) => `${name}=${value}`).join('; ');
}

async function serverApiRequest(
  input: URL,
  init: RequestInit = {}
): Promise<Response> {
  const cookieHeader = serializeCookies((await cookies()).getAll());
  const requestHeaders = apiHeaders(init.headers);

  if (cookieHeader) requestHeaders.set('cookie', cookieHeader);

  const response = await fetch(input, {
    ...init,
    cache: 'no-store',
    headers: requestHeaders,
  });

  if (response.status === 401) redirect('/logout');
  if (response.status === 403) redirect('/dashboard');

  return response;
}

export async function serverApiJson<T>(input: URL): Promise<T> {
  const response = await serverApiRequest(input);

  if (!response.ok) {
    const error = await readApiError(response);
    throw new PortalApiError(
      error.message ?? `API request failed with status ${response.status}`,
      response.status
    );
  }

  return (await response.json()) as T;
}

export async function serverApiJsonOrNull<T>(input: URL): Promise<T | null> {
  const response = await serverApiRequest(input);
  if (response.status === 404) return null;

  if (!response.ok) {
    const error = await readApiError(response);
    throw new PortalApiError(
      error.message ?? `API request failed with status ${response.status}`,
      response.status
    );
  }

  return (await response.json()) as T;
}
