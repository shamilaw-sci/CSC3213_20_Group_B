import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const serverEnvConfig = createEnv({
  server: {
    BASE_DOMAIN: z.string().min(1).default('scs.pdn.ac.lk'),
    MOODLE_URL: z.url().default('https://scilms.pdn.ac.lk'),
    WORKER_URL: z.url().default('https://scs-proxy-worker.scs-pdn.workers.dev'),
    CF_SECRET: z.string().min(1).default('default_secret_value'),
  },
  experimental__runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export default serverEnvConfig;
