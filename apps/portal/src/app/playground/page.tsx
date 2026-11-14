import type { Metadata } from 'next';

import { PublicDataPlayground } from '@/components/playground/public-data-playground';
import publicEnvConfig from '@/config/public.env.config';

export const metadata: Metadata = {
  title: 'Public data playground',
  description:
    'Build and validate copyable public data JSON for a manual pull request.',
  alternates: {
    canonical: `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}/playground`,
  },
};

export default function PlaygroundPage() {
  return <PublicDataPlayground />;
}
