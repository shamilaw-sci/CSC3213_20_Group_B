import { ALLOWED_ORIGINS } from '@/config/client.config';

export function createCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'PATCH, POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Id',
  };
}

export function createJsonResponse(
  body: unknown,
  status: number,
  origin: string
): Response {
  return Response.json(body, {
    status,
    headers: createCorsHeaders(origin),
  });
}

export function attachCorsHeaders(
  response: Response,
  origin: string
): Response {
  if (!ALLOWED_ORIGINS.includes(origin)) return response;

  const clonedResponse = new Response(response.body, response);
  const corsHeaderEntries = createCorsHeaders(origin);
  for (const [headerName, headerValue] of Object.entries(corsHeaderEntries)) {
    clonedResponse.headers.set(headerName, headerValue);
  }

  return clonedResponse;
}

export function createJsonErrorResponse(
  message: string,
  status: number,
  origin: string,
  code?: string
): Response {
  return createJsonResponse(
    { error: message, ...(code ? { code } : {}) },
    status,
    origin
  );
}

export function createTextErrorResponse(
  message: string,
  status: number,
  origin: string
): Response {
  return new Response(message, {
    status,
    headers: createCorsHeaders(origin),
  });
}

export function createMethodNotAllowedResponse(): Response {
  return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export function createCorsPreflightResponse(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: createCorsHeaders(origin),
  });
}

export function createNotFoundResponse(origin: string): Response {
  return createJsonErrorResponse('Not Found', 404, origin);
}

export function createInternalServerErrorResponse(origin: string): Response {
  return createJsonResponse({ error: 'Internal Server Error' }, 500, origin);
}

export function getRequestOrigin(req: Request): string {
  return req.headers.get('Origin') || req.headers.get('origin') || '';
}

export function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin);
}
