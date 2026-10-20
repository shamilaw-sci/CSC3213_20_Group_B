import type { MutationAccepted } from '@scs/schemas';

import { callGithubApp } from '@/clients/github-app.client';
import { createJsonResponse } from '@/http/responses';
import type { Env } from '@/types/env';

export interface MutationControlInput {
  idempotencyKey?: string;
  expectedRevision?: string;
}

export async function actorSubjectId(email: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(email.trim().toLowerCase())
  );
  return `usr_${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

export function mutationControl(value: unknown): MutationControlInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const candidate = value as Record<string, unknown>;
  return {
    ...(typeof candidate.idempotencyKey === 'string'
      ? { idempotencyKey: candidate.idempotencyKey }
      : {}),
    ...(typeof candidate.expectedRevision === 'string'
      ? { expectedRevision: candidate.expectedRevision }
      : {}),
  };
}

export async function submitMutationOperation(input: {
  env: Env;
  origin: string;
  path: string;
  actorEmail: string;
  envelope: Record<string, unknown>;
  control?: MutationControlInput;
}): Promise<Response> {
  const response = await callGithubApp<MutationAccepted>(
    input.env,
    input.origin,
    input.path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input.envelope,
        actorSubjectId: await actorSubjectId(input.actorEmail),
        idempotencyKey: input.control?.idempotencyKey ?? crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
      }),
    }
  );
  if (!response.ok) return response.response;
  return createJsonResponse(response.value, 202, input.origin);
}
