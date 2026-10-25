import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const publicEnvConfig = createEnv({
  client: {
    NEXT_PUBLIC_SITE_URL: z.url().default('https://projects.scs-pdn.space'),
    NEXT_PUBLIC_PROJECTS_DATA_BASE_URL: z
      .string()
      .min(1)
      .default('https://data.scs-pdn.space/projects/v2'),
    NEXT_PUBLIC_PEOPLE_SITE_URL: z
      .url()
      .default('https://people.scs-pdn.space'),
    NEXT_PUBLIC_DEPARTMENT_SITE_URL: z.url().default('https://scs.pdn.ac.lk'),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_PROJECTS_DATA_BASE_URL:
      process.env.NEXT_PUBLIC_PROJECTS_DATA_BASE_URL,
    NEXT_PUBLIC_PEOPLE_SITE_URL: process.env.NEXT_PUBLIC_PEOPLE_SITE_URL,
    NEXT_PUBLIC_DEPARTMENT_SITE_URL:
      process.env.NEXT_PUBLIC_DEPARTMENT_SITE_URL,
  },
  emptyStringAsUndefined: true,
});

export default publicEnvConfig;
