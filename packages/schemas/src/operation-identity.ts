import type { OperationActor } from '#schemas/api/operation.schema';

/** Matches the durable GitHub App operation ID for an actor and retry key. */
export async function operationIdForActorKey(
  actor: OperationActor,
  idempotencyKey: string
): Promise<string> {
  const canonical = JSON.stringify({
    actor: { subjectId: actor.subjectId, type: actor.type },
    idempotencyKey,
  });
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical)
  );
  return `op_${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')}`;
}
