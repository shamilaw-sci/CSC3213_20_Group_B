import { expect, test } from 'bun:test';

test('exposes mail content resolution before SMTP delivery', async () => {
  process.env.MAILER_API_KEY = 'test-mailer-api-key';

  const mailerService = await import('@/services/mailer.service');

  expect('resolveMailMessage' in mailerService).toBe(true);
});

test('renders the Portal OTP template to HTML and plain text', async () => {
  process.env.MAILER_API_KEY = 'test-mailer-api-key';
  const { resolveMailMessage } = await import('@/services/mailer.service');

  const message = await resolveMailMessage({
    to: 'student@eng.pdn.ac.lk',
    template: {
      name: 'portal-sign-in-otp',
      props: {
        otp: '123456',
        expiresInMinutes: 5,
      },
    },
  });

  expect(message.to).toBe('student@eng.pdn.ac.lk');
  expect(message.subject).toBe('SCS Portal sign-in code');
  expect(message.html).toContain('123456');
  expect(message.html).toContain('SCS Portal');
  expect(message.html).toContain('<!DOCTYPE html');
  expect(message.text).toContain('Your sign-in code is 123456.');
  expect(message.text).toContain('This code expires in 5 minutes.');
});
