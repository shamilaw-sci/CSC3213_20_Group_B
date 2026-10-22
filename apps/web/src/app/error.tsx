'use client';

import { Button } from '@scs/ui/components/button';
import { ErrorPageFlag } from '@scs/ui/components/error-page-flag';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => console.error(error), [error]);

  return (
    <main className="flex min-h-[70vh] items-center">
      <ErrorPageFlag />
      <FeedbackState
        icon={<AlertTriangle className="size-10" />}
        title="This page could not be loaded"
        description="The rest of the SCS website is still available. Try this page again, or return to the home page."
        actions={
          <Button type="button" onClick={reset}>
            <RefreshCw className="size-4" />
            Try this page again
          </Button>
        }
      />
    </main>
  );
}
