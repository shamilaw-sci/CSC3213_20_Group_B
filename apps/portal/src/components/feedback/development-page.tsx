import { Construction } from 'lucide-react';

import { PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';

interface DevPageProps {
  fallbackHref?: string;
  label?: string;
}

export default function DevPage({
  fallbackHref = '/dashboard',
  label = 'Back to Dashboard',
}: DevPageProps) {
  return (
    <PageShell className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <BackButton fallbackHref={fallbackHref} label={label} preferFallback />
      <Construction className="text-muted-foreground mt-8 mb-4 size-10" />
      <h1 className="text-2xl font-semibold text-foreground">
        Page Under Development
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm leading-6">
        This page is currently under development and will be available soon.
        Please check back later.
      </p>
    </PageShell>
  );
}
