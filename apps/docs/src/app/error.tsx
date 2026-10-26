'use client';

import { Button } from '@scs/ui/components/button';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => console.error(error), [error]);

  return (
    <main className="flex min-h-[70vh] items-center">
      <FeedbackState
        title="The documentation could not load"
        description="Try this page again. If the problem continues, report it with the page address."
        actions={
          <Button type="button" onClick={reset}>
            Try again
          </Button>
        }
      />
    </main>
  );
}
