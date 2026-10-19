import { authClient } from '@/lib/auth-client';

interface BetterAuthClientError {
  code?: string;
  message?: string;
  status: number;
  statusText: string;
}

export interface PasskeyCredential {
  id: string;
  createdAt: number;
  transports?: string[];
  name?: string;
}

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

function throwPasskeyError(error: BetterAuthClientError | null): void {
  if (!error) return;

  throw new PasskeyApiError(
    error.message ?? error.statusText ?? 'Passkey request failed.',
    error.status,
    error.code
  );
}

export function passkeysAreSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials !== 'undefined'
  );
}

export function isPasskeyApiError(error: unknown): error is PasskeyApiError {
  return error instanceof PasskeyApiError;
}

export async function authenticateWithPasskey() {
  const { data, error } = await authClient.signIn.passkey();
  throwPasskeyError(error);

  return {
    verified: Boolean(data?.session),
    redirectTo: '/dashboard',
  };
}

export async function registerPasskey(name?: string) {
  const { data, error } = await authClient.passkey.addPasskey({
    ...(name ? { name } : {}),
  });
  throwPasskeyError(error);

  return {
    verified: Boolean(data),
    credentialId: data?.id,
  };
}

export async function updatePasskeyCredential(
  credentialId: string,
  name: string
) {
  const { data, error } = await authClient.passkey.updatePasskey({
    id: credentialId,
    name,
  });
  throwPasskeyError(error);
  return { success: Boolean(data) };
}

export async function listPasskeyCredentials() {
  const { data, error } = await authClient.passkey.listUserPasskeys();
  throwPasskeyError(error);

  return (data ?? []).map((credential) => ({
    id: credential.id,
    createdAt: new Date(credential.createdAt).getTime(),
    transports: credential.transports
      ? credential.transports.split(',').filter(Boolean)
      : undefined,
    name: credential.name,
  }));
}

export async function deletePasskeyCredential(credentialId: string) {
  const { data, error } = await authClient.passkey.deletePasskey({
    id: credentialId,
  });
  throwPasskeyError(error);
  return { success: Boolean(data) };
}
