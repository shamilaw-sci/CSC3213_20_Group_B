import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { z } from 'zod';

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

async function readJsonResponse<TSchema extends z.ZodType>(
  response: Response,
  input: URL,
  schema: TSchema,
  emptyBody?: 'null'
): Promise<z.output<TSchema>> {
  let value: unknown;
  if (response.status === 204 && emptyBody === 'null') {
    value = null;
  } else {
    try {
      value = await response.json();
    } catch (error) {
      throw new Error(`Invalid JSON response from ${input.pathname}`, {
        cause: error,
      });
    }
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Invalid API response from ${input.pathname}: ${parsed.error.issues
        .map(
          (issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`
        )
        .join('; ')}`,
      { cause: parsed.error }
    );
  }
  return parsed.data;
}

export async function serverApiJson<TSchema extends z.ZodType>(
  input: URL,
  schema: TSchema,
  options?: { emptyBody?: 'null' }
): Promise<z.output<TSchema>>;
export async function serverApiJson(input: URL): Promise<unknown>;
export async function serverApiJson(
  input: URL,
  schema?: z.ZodType,
  options?: { emptyBody?: 'null' }
): Promise<unknown> {
  const response = await serverApiRequest(input);

  if (!response.ok) {
    const error = await readApiError(response);
    throw new PortalApiError(
      error.message ?? `API request failed with status ${response.status}`,
      response.status
    );
  }

  return schema
    ? readJsonResponse(response, input, schema, options?.emptyBody)
    : response.json();
}

export async function serverApiJsonOrNull<TSchema extends z.ZodType>(
  input: URL,
  schema: TSchema,
  options?: { emptyBody?: 'null' }
): Promise<z.output<TSchema> | null>;
export async function serverApiJsonOrNull(input: URL): Promise<unknown | null>;
export async function serverApiJsonOrNull(
  input: URL,
  schema?: z.ZodType,
  options?: { emptyBody?: 'null' }
): Promise<unknown | null> {
  const response = await serverApiRequest(input);
  if (response.status === 404) return null;

  if (!response.ok) {
    const error = await readApiError(response);
    throw new PortalApiError(
      error.message ?? `API request failed with status ${response.status}`,
      response.status
    );
  }

  return schema
    ? readJsonResponse(response, input, schema, options?.emptyBody)
    : response.json();
}
