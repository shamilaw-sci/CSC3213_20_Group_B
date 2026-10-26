import publicEnvConfig from '@/config/public.env.config';

export const siteConfig = {
  name: 'SCS PDN Documentation',
  description:
    'Technical handbook for the SCS PDN applications, services, packages, contracts, and operations.',
  origin: new URL(publicEnvConfig.NEXT_PUBLIC_DOCS_SITE_URL),
  repositoryUrl: 'https://github.com/csc3213-2026-group-b/scs-pdn-monorepo',
} as const;
