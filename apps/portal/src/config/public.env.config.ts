import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const publicEnvConfig = createEnv({
  client: {
    NEXT_PUBLIC_SITE_URL: z.url().default('https://portal.scs-pdn.space'),
    NEXT_PUBLIC_BASE_API_URL: z.url().default('https://api.scs-pdn.space'),
    NEXT_PUBLIC_PEOPLE_DATA_BASE_URL: z
      .url()
      .default('https://data.scs-pdn.space/people/v2'),
    NEXT_PUBLIC_VERIFICATION_CODE_MAX_LENGTH: z.coerce
      .number()
      .int()
      .positive()
      .default(6),
    NEXT_PUBLIC_API_CLIENT_ID: z.string().min(1).default('portal'),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_BASE_API_URL: process.env.NEXT_PUBLIC_BASE_API_URL,
    NEXT_PUBLIC_PEOPLE_DATA_BASE_URL:
      process.env.NEXT_PUBLIC_PEOPLE_DATA_BASE_URL,
    NEXT_PUBLIC_VERIFICATION_CODE_MAX_LENGTH:
      process.env.NEXT_PUBLIC_VERIFICATION_CODE_MAX_LENGTH,
    NEXT_PUBLIC_API_CLIENT_ID: process.env.NEXT_PUBLIC_API_CLIENT_ID,
  },
  emptyStringAsUndefined: true,
});

export default publicEnvConfig;
