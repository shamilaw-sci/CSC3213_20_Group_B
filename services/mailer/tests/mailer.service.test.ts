import { expect, test } from 'bun:test';
import { render } from '@react-email/render';
import { createTransport } from 'nodemailer';

import { PortalSignInOtpEmail } from '@/emails/portal-sign-in-otp.email';

test('exposes mail content resolution before SMTP delivery', async () => {
  process.env.MAILER_API_KEY = 'test-mailer-api-key';

  const mailerService = await import('@/services/mailer.service');

  expect('resolveMailMessage' in mailerService).toBe(true);
});

test.each([
  ['123456', 'https://portal.scs-pdn.space'],
  ['000042', 'https://portal.scs.pdn.ac.lk'],
  ['000042', 'http://portal.scs-pdn.localhost:3000'],
])(
  'renders Portal login code %s for %s consistently in both alternatives',
  async (otp, origin) => {
    process.env.MAILER_API_KEY = 'test-mailer-api-key';
    const { resolveMailMessage } = await import('@/services/mailer.service');

    const message = await resolveMailMessage({
      to: 'student@eng.pdn.ac.lk',
      template: {
        name: 'portal-sign-in-otp',
        origin,
        props: {
          otp,
          expiresInMinutes: 5,
        },
      },
    });

    expect(message.to).toBe('student@eng.pdn.ac.lk');
    expect(message.subject).toBe(`${otp} - Your SCS Portal login code`);
    expect(message.otp).toEqual({
      code: otp,
      origin,
    });
    expect(message.html).toContain(otp);
    expect(message.html).toContain('SCS Portal');
    expect(message.html).toContain('<!DOCTYPE html');
    expect(message.html?.match(new RegExp(otp, 'g'))).toHaveLength(1);
    expect(message.text?.match(new RegExp(otp, 'g'))).toHaveLength(1);
    expect(message.text).toContain(
      'Use this SCS Portal login code to sign in:'
    );
    expect(message.text).toContain('This code expires in 5 minutes');
    expect(message.text).toContain('can be used only once');
    expect(message.text).toContain('If you did not request a login code');

    const smtpMessage = await createTransport({
      streamTransport: true,
      buffer: true,
    }).sendMail({ from: 'SCS Portal <portal@example.com>', ...message });
    const mime = smtpMessage.message.toString();
    expect(mime).toContain('Content-Type: multipart/alternative;');
    expect(mime).toContain('Content-Type: text/plain; charset=utf-8');
    expect(mime).toContain('Content-Type: text/html; charset=utf-8');
    const topLevelHeaders = mime.split(/\r?\n\r?\n/, 1)[0] ?? '';
    expect(topLevelHeaders.match(/^OTP-Token:/gm)).toEqual(['OTP-Token:']);
    expect(topLevelHeaders).toContain(
      `OTP-Token: "${otp}"; origin="${origin}"`
    );
  }
);

test('escapes template values in HTML', async () => {
  const html = await render(
    PortalSignInOtpEmail({
      otp: '<script>alert(1)</script>',
      expiresInMinutes: 5,
    })
  );

  expect(html).not.toContain('<script>alert(1)</script>');
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('keeps OTP metadata off raw notification messages', async () => {
  const { resolveMailMessage } = await import('@/services/mailer.service');
  const message = await resolveMailMessage({
    to: 'student@eng.pdn.ac.lk',
    subject: 'Existing notification',
    text: 'Hello',
  });
  expect(message.otp).toBeUndefined();

  const smtpMessage = await createTransport({
    streamTransport: true,
    buffer: true,
  }).sendMail({ from: 'SCS Portal <portal@example.com>', ...message });
  expect(smtpMessage.message.toString()).not.toContain('OTP-Token:');
});

test('lets Nodemailer reject an invalid OTP origin before delivery', async () => {
  const transport = createTransport({ streamTransport: true, buffer: true });
  await expect(
    transport.sendMail({
      from: 'SCS Portal <portal@example.com>',
      to: 'student@eng.pdn.ac.lk',
      subject: 'Login code',
      text: '123456',
      otp: { code: '123456', origin: 'http://attacker.example' },
    })
  ).rejects.toMatchObject({ code: 'EOTP' });
});
