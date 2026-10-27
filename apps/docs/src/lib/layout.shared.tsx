import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { DocsBrand } from '@/components/layout/docs-brand';
import { siteConfig } from '@/config/site.config';

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: siteConfig.repositoryUrl,
    links: [
      {
        text: 'Department website',
        url: 'https://scs-pdn.space',
        external: true,
      },
    ],
    nav: {
      title: <DocsBrand />,
      url: '/',
    },
  };
}
