import { apiHeaders, readApiError } from '@/lib/api';

interface SignedConfigUrl {
  url: string;
  expiresAt: string;
}

export class ConfigFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'ConfigFetchError';
  }
}

export interface ProxyFileConfig {
  proxy: {
    active: boolean;
    url: string;
    availableAttempts?: number;
    updatedAt?: string;
    updatedBy?: string;
  };
}

export interface AllProxyConfig {
  schemaVersion: 1;
  generatedAt: string | null;
  users: Record<
    string,
    {
      username: string;
      proxy: ProxyFileConfig['proxy'];
    }
  >;
}

async function requestSignedUrl(endpoint: URL): Promise<SignedConfigUrl> {
  const res = await fetch(endpoint, {
    credentials: 'include',
    cache: 'no-store',
    headers: apiHeaders(),
  });

  if (!res.ok) {
    const body = await readApiError(res);
    throw new ConfigFetchError(
      body.message ?? 'Failed to create config read URL',
      res.status
    );
  }

  return (await res.json()) as SignedConfigUrl;
}

async function fetchSignedJson<T>(endpoint: URL): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const signed = await requestSignedUrl(endpoint);
    const res = await fetch(signed.url, { cache: 'no-store' });

    if (res.status === 404) return null;
    if ((res.status === 401 || res.status === 403) && attempt === 0) {
      continue;
    }

    if (!res.ok) {
      throw new ConfigFetchError('Failed to fetch signed config', res.status);
    }

    return (await res.json()) as T;
  }

  throw new ConfigFetchError('Failed to fetch signed config');
}

export async function fetchUserProxyConfig(
  endpoint: URL
): Promise<ProxyFileConfig | null> {
  return fetchSignedJson<ProxyFileConfig>(endpoint);
}

export async function fetchAllProxyConfig(
  endpoint: URL
): Promise<AllProxyConfig | null> {
  return fetchSignedJson<AllProxyConfig>(endpoint);
}
