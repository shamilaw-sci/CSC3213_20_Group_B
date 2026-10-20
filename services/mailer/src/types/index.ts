import { z } from 'zod';

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
