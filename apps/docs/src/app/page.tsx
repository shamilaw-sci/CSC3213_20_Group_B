import { HomeLayout } from 'fumadocs-ui/layouts/home';

import { DocsHome } from '@/components/layout/docs-home';
import { baseOptions } from '@/lib/layout.shared';

export default function HomePage() {
  return (
    <HomeLayout {...baseOptions()}>
      <DocsHome />
    </HomeLayout>
  );
}
