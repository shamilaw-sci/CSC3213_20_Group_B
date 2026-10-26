import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const publicEnvConfig = createEnv({
  client: {
    NEXT_PUBLIC_DOCS_SITE_URL: z.url().default('https://docs.scs-pdn.space'),
  },
  runtimeEnv: {
    NEXT_PUBLIC_DOCS_SITE_URL: process.env.NEXT_PUBLIC_DOCS_SITE_URL,
  },
  emptyStringAsUndefined: true,
});

export default publicEnvConfig;
