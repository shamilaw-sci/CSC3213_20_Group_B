import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const publicEnvConfig = createEnv({
  client: {
    NEXT_PUBLIC_SITE_URL: z.url().default('https://scs-pdn.space'),
    NEXT_PUBLIC_PEOPLE_SITE_URL: z
      .url()
      .default('https://people.scs-pdn.space'),
    NEXT_PUBLIC_PROJECTS_SITE_URL: z
      .url()
      .default('https://projects.scs-pdn.space'),
    NEXT_PUBLIC_ELEARNING_SITE_URL: z.url().default('https://scilms.pdn.ac.lk'),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_PEOPLE_SITE_URL: process.env.NEXT_PUBLIC_PEOPLE_SITE_URL,
    NEXT_PUBLIC_PROJECTS_SITE_URL: process.env.NEXT_PUBLIC_PROJECTS_SITE_URL,
    NEXT_PUBLIC_ELEARNING_SITE_URL: process.env.NEXT_PUBLIC_ELEARNING_SITE_URL,
  },
  emptyStringAsUndefined: true,
});

export default publicEnvConfig;
