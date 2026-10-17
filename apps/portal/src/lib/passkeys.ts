import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';

import {
  apiHeaders,
  passkeyCredentialApiUrl,
  passkeyCredentialsApiUrl,
  passkeyLoginOptionsApiUrl,
  passkeyLoginVerifyApiUrl,
  passkeyRegisterOptionsApiUrl,
  passkeyRegisterVerifyApiUrl,
  readApiError,
} from '@/lib/api';

interface PasskeyApiResponse {
  redirectTo?: string;
  message?: string;
  code?: string;
}

export interface PasskeyCredential {
  id: string;
  createdAt: number;
  transports?: string[];
  name?: string;
}

type RegistrationOptions = Parameters<
  typeof startRegistration
>[0]['optionsJSON'];

type AuthenticationOptions = Parameters<
  typeof startAuthentication
>[0]['optionsJSON'];

class PasskeyApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'PasskeyApiError';
    this.status = status;
    this.code = code;
  }
}

async function fetchPasskeyJson<TResponse>(
  path: URL,
  init?: RequestInit
): Promise<TResponse> {
  const headers = apiHeaders(init?.headers);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...Object.fromEntries(headers.entries()),
    },
  });

  if (!response.ok) {
    const data = await readApiError(response);
    throw new PasskeyApiError(
      data.message ?? 'Passkey request failed. Please try again.',
      response.status,
      data.code
    );
  }

  const data = (await response.json().catch(() => ({}))) as PasskeyApiResponse;
  return data as TResponse;
}

export function passkeysAreSupported() {
  return browserSupportsWebAuthn();
}

export function isPasskeyApiError(error: unknown): error is PasskeyApiError {
  return error instanceof PasskeyApiError;
}

export async function authenticateWithPasskey(email?: string) {
  const optionsJSON = await fetchPasskeyJson<
    | {
        challenge: string;
        allowCredentials: Array<{ id: string; type: 'public-key' }>;
      }
    | Record<string, unknown>
  >(passkeyLoginOptionsApiUrl(), {
    method: 'POST',
    body: JSON.stringify(email?.trim() ? { email: email.trim() } : {}),
  });

  function hasAuthenticationOptions(
    obj: unknown
  ): obj is AuthenticationOptions {
    return typeof obj === 'object' && obj !== null && 'challenge' in obj;
  }

  if (!hasAuthenticationOptions(optionsJSON)) {
    throw new PasskeyApiError(
      'Invalid authentication options from server',
      500
    );
  }

  const credential = await startAuthentication({ optionsJSON: optionsJSON });

  return fetchPasskeyJson<{
    verified: boolean;
    redirectTo?: string;
  }>(passkeyLoginVerifyApiUrl(), {
    method: 'POST',
    body: JSON.stringify({ response: credential }),
  });
}

export async function registerPasskey(name?: string) {
  const optionsJSON = await fetchPasskeyJson<
    { registrationOptions: RegistrationOptions } | RegistrationOptions
  >(passkeyRegisterOptionsApiUrl(), {
    method: 'POST',
    body: JSON.stringify(name?.trim() ? { name: name.trim() } : {}),
  });

  function hasRegistrationOptions(
    obj: unknown
  ): obj is { registrationOptions: RegistrationOptions } {
    return (
      typeof obj === 'object' && obj !== null && 'registrationOptions' in obj
    );
  }

  // support either `{ registrationOptions }` or direct options
  const registrationOptions = hasRegistrationOptions(optionsJSON)
    ? optionsJSON.registrationOptions
    : optionsJSON;

  const credential = await startRegistration({
    optionsJSON: registrationOptions,
  });

  return fetchPasskeyJson<{
    verified: boolean;
    credentialId?: string;
  }>(passkeyRegisterVerifyApiUrl(), {
    method: 'POST',
    body: JSON.stringify({ response: credential }),
  });
}

export async function updatePasskeyCredential(
  credentialId: string,
  name: string
) {
  return fetchPasskeyJson<{ success: boolean }>(
    passkeyCredentialApiUrl(credentialId),
    {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }
  );
}

export async function listPasskeyCredentials() {
  const data = await fetchPasskeyJson<{ credentials: PasskeyCredential[] }>(
    passkeyCredentialsApiUrl()
  );

  return data.credentials ?? [];
}

export async function deletePasskeyCredential(credentialId: string) {
  return fetchPasskeyJson<{ success: boolean }>(
    passkeyCredentialApiUrl(credentialId),
    {
      method: 'DELETE',
    }
  );
}
