import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const processEnv = createEnv({
  server: {
    MAILER_API_KEY: z.string().min(1),
    SMTP_HOST: z.string().min(1).default('smtp.example.com'),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_USER: z.string().default(''),
    SMTP_PASS: z.string().default(''),
    SMTP_FROM: z.string().optional(),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export const env = {
  ...processEnv,
  SMTP_FROM: processEnv.SMTP_FROM ?? processEnv.SMTP_USER,
};
