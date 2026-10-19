export type GithubErrorCategory =
  | 'not_found'
  | 'missing_ref'
  | 'compare_conflict'
  | 'validation'
  | 'primary_rate_limit'
  | 'secondary_rate_limit'
  | 'transient_server'
  | 'unknown';

export interface GithubErrorClassification {
  category: GithubErrorCategory;
  retryable: boolean;
  retryAfterMs?: number;
  status?: number;
}

interface GithubErrorShape {
  message?: unknown;
  status?: unknown;
  response?: { headers?: unknown };
}

function errorShape(error: unknown): GithubErrorShape {
  return typeof error === 'object' && error !== null ? error : {};
}

function headerValue(headers: unknown, name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  if (!headers || typeof headers !== 'object') return undefined;

  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()];
  return typeof value === 'string' ? value : undefined;
}

function retryAfterMs(headers: unknown): number | undefined {
  const retryAfter = headerValue(headers, 'retry-after');
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

export function classifyGithubError(error: unknown): GithubErrorClassification {
  const shape = errorShape(error);
  const status = typeof shape.status === 'number' ? shape.status : undefined;
  const message =
    typeof shape.message === 'string' ? shape.message.toLowerCase() : '';
  const headers = shape.response?.headers;

  if (status === 404)
    return { category: 'not_found', retryable: false, status };
  if (
    status === 422 &&
    (message.includes('reference does not exist') ||
      message.includes('ref does not exist'))
  ) {
    return { category: 'missing_ref', retryable: false, status };
  }
  if (
    status === 409 ||
    (status === 422 &&
      (message.includes('not a fast forward') ||
        message.includes('reference update failed')))
  ) {
    return { category: 'compare_conflict', retryable: false, status };
  }

  const remaining = headerValue(headers, 'x-ratelimit-remaining');
  if ((status === 403 || status === 429) && remaining === '0') {
    return {
      category: 'primary_rate_limit',
      retryable: true,
      retryAfterMs: retryAfterMs(headers),
      status,
    };
  }
  if (
    status === 429 ||
    (status === 403 && message.includes('secondary rate limit'))
  ) {
    return {
      category: 'secondary_rate_limit',
      retryable: true,
      retryAfterMs: retryAfterMs(headers),
      status,
    };
  }
  if (status === 422) {
    return { category: 'validation', retryable: false, status };
  }
  if (status !== undefined && status >= 500) {
    return { category: 'transient_server', retryable: true, status };
  }

  return { category: 'unknown', retryable: false, status };
}

export class RepositoryConflictError extends Error {
  constructor(
    public readonly expectedSha: string,
    public readonly currentSha: string
  ) {
    super(
      `Repository ref changed from ${expectedSha} to ${currentSha}; refresh and retry`
    );
    this.name = 'RepositoryConflictError';
  }
}
