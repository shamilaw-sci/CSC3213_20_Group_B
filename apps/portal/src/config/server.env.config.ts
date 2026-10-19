import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const serverEnvConfig = createEnv({
  server: {
    COOKIE_DOMAIN: z.string().min(1).default('.scs-pdn.space'),
  },
  experimental__runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export default serverEnvConfig;
