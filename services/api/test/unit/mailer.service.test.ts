import { afterEach, expect, spyOn, test } from 'bun:test';

import * as mailerService from '@/services/mailer.service';

test('exposes a typed Portal OTP mail request helper', () => {
  expect('sendPortalSignInOtpEmail' in mailerService).toBe(true);
});

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

test('sends OTP data as a named template without raw email markup', async () => {
  const fetchMock = spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({ ok: true })
  );

  await mailerService.sendPortalSignInOtpEmail(
    'student@eng.pdn.ac.lk',
    '123456',
    5,
    'https://mailer.example.test',
    'test-api-key'
  );

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  expect(url).toBe('https://mailer.example.test/send');
  expect(JSON.parse(String(init?.body))).toEqual({
    to: 'student@eng.pdn.ac.lk',
    template: {
      name: 'portal-sign-in-otp',
      props: {
        otp: '123456',
        expiresInMinutes: 5,
      },
    },
  });
});

test('does not include an upstream HTML document in a mailer error', async () => {
  spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('<!doctype html><html>Bad gateway</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  );

  await expect(
    mailerService.sendPortalSignInOtpEmail(
      'student@eng.pdn.ac.lk',
      '123456',
      5,
      'https://mailer.example.test',
      'test-api-key'
    )
  ).rejects.toThrow(/^Mailer API error 502$/);
});

test('preserves a validated Mailer error message', async () => {
  spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({ ok: false, error: 'SMTP unavailable' }, { status: 502 })
  );

  await expect(
    mailerService.sendPortalSignInOtpEmail(
      'student@eng.pdn.ac.lk',
      '123456',
      5,
      'https://mailer.example.test',
      'test-api-key'
    )
  ).rejects.toThrow('Mailer API error 502: SMTP unavailable');
});

test('rejects a malformed successful Mailer response', async () => {
  spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({ ok: true, unexpected: 'field' })
  );

  await expect(
    mailerService.sendPortalSignInOtpEmail(
      'student@eng.pdn.ac.lk',
      '123456',
      5,
      'https://mailer.example.test',
      'test-api-key'
    )
  ).rejects.toThrow('Mailer API returned an invalid response');
});
