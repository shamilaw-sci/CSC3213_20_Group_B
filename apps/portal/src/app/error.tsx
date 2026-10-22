'use client';

import { Button } from '@scs/ui/components/button';
import { ErrorPageFlag } from '@scs/ui/components/error-page-flag';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import { RefreshCw } from 'lucide-react';
import Image from 'next/image';
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
        icon={
          <Image
            src="/favicon/logo-symbol-icon.svg"
            alt=""
            width={72}
            height={72}
          />
        }
        title="This portal page could not load"
        description="Your account and submitted data have not been changed. Try loading this page again."
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
