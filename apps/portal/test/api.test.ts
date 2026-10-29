import { describe, expect, test } from 'bun:test';

import { readApiError } from '@/lib/api';

describe('Portal API error responses', () => {
  test('preserves a short JSON API error', async () => {
    const response = Response.json(
      {
        error: 'Invalid request',
        message: 'Aggregate paths do not match the profile.',
        code: 'invalid_request',
      },
      { status: 400 }
    );

    expect(await readApiError(response)).toEqual({
      error: 'Invalid request',
      message: 'Aggregate paths do not match the profile.',
      code: 'invalid_request',
    });
  });

  test('preserves a short plain-text API error', async () => {
    const response = new Response('Unauthorized', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

    expect(await readApiError(response)).toEqual({
      error: 'Unauthorized',
      message: 'Unauthorized',
    });
  });

  test('does not expose an HTML error document as a message', async () => {
    const response = new Response(
      '<!doctype html><html><title>404 - Page Not Found</title></html>',
      {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );

    expect(await readApiError(response)).toEqual({
      error: 'Request failed with status 404',
      message: 'Request failed with status 404',
    });
  });

  test('does not expose an oversized plain-text response', async () => {
    const response = new Response('x'.repeat(501), {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

    expect(await readApiError(response)).toEqual({
      error: 'Request failed with status 502',
      message: 'Request failed with status 502',
    });
  });
});
