import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const serverEnvConfig = createEnv({
  server: {
    BASE_DOMAIN: z.string().min(1).default('scs-pdn.space'),
    MOODLE_URL: z.url().default('https://scilms.pdn.ac.lk'),
    PROXY_API_URL: z.url().default('https://api.scs-pdn.space'),
    WEB_PROXY_INTERNAL_SECRET: z
      .string()
      .min(1)
      .default('development-only-proxy-secret'),
  },
  experimental__runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export default serverEnvConfig;
