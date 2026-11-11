import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { DocsBrand } from '@/components/layout/docs-brand';
import { siteConfig } from '@/config/site.config';

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: siteConfig.orgUrl,
    links: [
      {
        text: 'Department website',
        url: 'https://scs-pdn.space',
        external: true,
      },
      {
        text: 'People Directory',
        url: 'https://people.scs-pdn.space',
        external: true,
      },
      {
        text: 'Projects Directory',
        url: 'https://projects.scs-pdn.space',
        external: true,
      },
      {
        text: 'SCS PDN Portal',
        url: 'https://portal.scs-pdn.space',
        external: true,
      },
    ],
    nav: {
      title: <DocsBrand />,
      url: '/',
    },
  };
}
