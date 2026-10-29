import { createJsonErrorResponse, createJsonResponse } from '@/http/responses';
import type { Env } from '@/types/env';

const DEFAULT_TIMEOUT_MS = 10_000;
const INTERNAL_ORIGIN = 'https://github-app.internal';

interface GithubAppClientOptions {
  timeoutMs?: number;
}

type GithubAppResult<T> =
  { ok: true; value: T } | { ok: false; response: Response };

interface GithubAppErrorDetails {
  code?: string;
  message?: string;
  field?: string;
  reason?: string;
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function errorDetails(value: unknown): GithubAppErrorDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const body = value as {
    code?: unknown;
    error?: unknown;
    field?: unknown;
    message?: unknown;
    reason?: unknown;
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
    code: boundedString(body.code, 128),
    message: boundedString(body.message, 500) ?? boundedString(body.error, 500),
    field: boundedString(body.field, 200),
    reason: boundedString(body.reason, 500),
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
      const message =
        details.message ??
        `GitHub App request failed: ${response.statusText || response.status}`;
      if (details.field || details.reason) {
        return {
          ok: false,
          response: createJsonResponse(
            {
              error: message,
              ...(details.reason ? { message: details.reason } : {}),
              ...(details.code ? { code: details.code } : {}),
              ...(details.field ? { field: details.field } : {}),
              ...(details.reason ? { reason: details.reason } : {}),
            },
            response.status,
            origin
          ),
        };
      }
      return {
        ok: false,
        response: createJsonErrorResponse(
          message,
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
