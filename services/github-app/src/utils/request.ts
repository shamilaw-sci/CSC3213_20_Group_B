import type { ZodError } from 'zod';

export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function createValidationErrorResponse(error: ZodError): Response {
  const issue = error.issues[0];

  return Response.json(
    {
      success: false,
      message: 'Invalid request',
      field: issue?.path.join('.') || undefined,
      reason: issue?.message,
    },
    { status: 400 }
  );
}
