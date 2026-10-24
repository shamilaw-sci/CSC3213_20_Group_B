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
