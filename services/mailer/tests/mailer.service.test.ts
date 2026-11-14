import { expect, test } from 'bun:test';
import { render } from '@react-email/render';
import { createTransport } from 'nodemailer';

import { PortalSignInOtpEmail } from '@/emails/portal-sign-in-otp.email';

test('exposes mail content resolution before SMTP delivery', async () => {
  process.env.MAILER_API_KEY = 'test-mailer-api-key';

  const mailerService = await import('@/services/mailer.service');

  expect('resolveMailMessage' in mailerService).toBe(true);
});

test.each(['123456', '000042'])(
  'renders the Portal login code %s consistently in both alternatives',
  async (otp) => {
    process.env.MAILER_API_KEY = 'test-mailer-api-key';
    const { resolveMailMessage } = await import('@/services/mailer.service');

    const message = await resolveMailMessage({
      to: 'student@eng.pdn.ac.lk',
      template: {
        name: 'portal-sign-in-otp',
        props: {
          otp,
          expiresInMinutes: 5,
        },
      },
    });

    expect(message.to).toBe('student@eng.pdn.ac.lk');
    expect(message.subject).toBe(`${otp} - Your SCS Portal login code`);
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
