import { z } from 'zod';

const MailRecipientSchema = z.union([
  z.email(),
  z.array(z.email()).min(1).max(50),
]);

const RawMailerSendRequestSchema = z
  .object({
    to: MailRecipientSchema,
    subject: z.string().trim().min(1),
    html: z.string().trim().min(1).optional(),
    text: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine(
    (request) => request.html !== undefined || request.text !== undefined,
    {
      message: 'At least one of html or text must be provided',
      path: ['html'],
    }
  );

const PortalSignInOtpRequestSchema = z
  .object({
    to: MailRecipientSchema,
    template: z
      .object({
        name: z.literal('portal-sign-in-otp'),
        props: z
          .object({
            otp: z.string().regex(/^\d{6}$/),
            expiresInMinutes: z.number().int().min(1).max(60),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export const MailerSendRequestSchema = z.union([
  RawMailerSendRequestSchema,
  PortalSignInOtpRequestSchema,
]);

export const MailerSendResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }).strict(),
  z
    .object({
      ok: z.literal(false),
      error: z.string().trim().min(1).max(1_000),
    })
    .strict(),
]);

export type MailerSendRequest = z.infer<typeof MailerSendRequestSchema>;
export type MailerSendResponse = z.infer<typeof MailerSendResponseSchema>;
export type PortalSignInOtpRequest = z.infer<
  typeof PortalSignInOtpRequestSchema
>;
