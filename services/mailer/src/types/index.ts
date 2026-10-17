import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

/** JSON body accepted by `POST /send`. */
export const sendRequestSchema = z
  .object({
    to: z.union([
      z.email(),
      z.array(z.email()).min(1, 'At least one recipient is required'),
    ]),
    subject: z.string().trim().min(1, 'Subject is required'),
    html: z.string().min(1).optional(),
    text: z.string().min(1).optional(),
  })
  .refine((data) => data.html !== undefined || data.text !== undefined, {
    message: 'At least one of html or text must be provided',
    path: ['html'],
  });

export type SendRequest = z.infer<typeof sendRequestSchema>;

/** Unified API response. */
export const sendResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export type SendResponse = z.infer<typeof sendResponseSchema>;

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Environment variables consumed by the mailer. */
export const envSchema = z.object({
  MAILER_API_KEY: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535),
  SMTP_SECURE: z.string().transform((value) => value.toLowerCase() === 'true'),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.email(),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
