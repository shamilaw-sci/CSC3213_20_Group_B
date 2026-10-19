import { createJsonErrorResponse } from '@/http/responses';
import type { Env } from '@/types/env';

const DEFAULT_TIMEOUT_MS = 10_000;
const INTERNAL_ORIGIN = 'https://github-app.internal';

interface GithubAppClientOptions {
  timeoutMs?: number;
}

type GithubAppResult<T> =
  { ok: true; value: T } | { ok: false; response: Response };

function errorDetails(value: unknown): { code?: string; message?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const body = value as {
    code?: unknown;
    error?: unknown;
    message?: unknown;
    version?: unknown;
  };
  if (
    body.version === 1 &&
    body.error &&
    typeof body.error === 'object' &&
    !Array.isArray(body.error)
  ) {
    const error = body.error as { code?: unknown; message?: unknown };
    return {
      code: typeof error.code === 'string' ? error.code : undefined,
      message: typeof error.message === 'string' ? error.message : undefined,
    };
  }

  return {
    code: typeof body.code === 'string' ? body.code : undefined,
    message:
      typeof body.message === 'string'
        ? body.message
        : typeof body.error === 'string'
          ? body.error
          : undefined,
  };
}

export async function callGithubApp<T>(
  env: Env,
  origin: string,
  path: string,
  init?: RequestInit,
  options: GithubAppClientOptions = {}
): Promise<GithubAppResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  const headers = new Headers(init?.headers);
  headers.set('X-Internal-Secret', env.GITHUB_APP_INTERNAL_SECRET);
  headers.set(
    'X-Correlation-Id',
    headers.get('X-Correlation-Id') ?? crypto.randomUUID()
  );

  const relayAbort = () => controller.abort();
  init?.signal?.addEventListener('abort', relayAbort, { once: true });

  try {
    const url = new URL(path, env.GITHUB_APP_API_URL).toString();
    const requestInit: RequestInit = {
      ...init,
      headers,
      signal: controller.signal,
    };
    const response = env.GITHUB_APP
      ? await env.GITHUB_APP.fetch(
          new Request(new URL(path, INTERNAL_ORIGIN), requestInit)
        )
      : await fetch(url, requestInit);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const details = errorDetails(body);
      return {
        ok: false,
        response: createJsonErrorResponse(
          details.message ??
            `GitHub App request failed: ${response.statusText || response.status}`,
          response.status,
          origin,
          details.code
        ),
      };
    }

    try {
      return { ok: true, value: (await response.json()) as T };
    } catch {
      return {
        ok: false,
        response: createJsonErrorResponse(
          'GitHub App returned an invalid response',
          502,
          origin,
          'github_app_invalid_response'
        ),
      };
    }
  } catch {
    const timedOut = controller.signal.aborted && !init?.signal?.aborted;
    return {
      ok: false,
      response: createJsonErrorResponse(
        timedOut ? 'GitHub App request timed out' : 'GitHub App request failed',
        timedOut ? 504 : 502,
        origin,
        timedOut ? 'github_app_timeout' : 'github_app_unavailable'
      ),
    };
  } finally {
    clearTimeout(timeout);
    init?.signal?.removeEventListener('abort', relayAbort);
  }
}
