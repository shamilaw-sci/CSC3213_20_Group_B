'use client';

import { Button } from '@scs/ui/components/button';
import { RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useEffect } from 'react';

import { ErrorPageFlag } from '@/components/custom/theme/error-page-flag';

export default function Error({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background p-4 text-foreground">
      <ErrorPageFlag />
      <div className="w-full max-w-md rounded-md border border-border bg-card p-8 text-center shadow-2xl">
        <div className="mx-auto mb-6 h-24 w-24">
          <Image
            src="/favicon/logo-symbol-icon.svg"
            alt="University of Peradeniya"
            width={96}
            height={96}
            className="h-full w-full object-contain"
          />
        </div>

        <h2 className="mb-2 text-2xl font-bold text-foreground">
          Something went wrong
        </h2>

        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          We could not load this page. Try again, or contact{' '}
          <a
            href="mailto:contact@scs-pdn.space"
            className="text-primary underline"
          >
            contact@scs-pdn.space
          </a>{' '}
          for support.
          <br />
          <span className="mt-2 inline-block rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
            Error: {error.message}
          </span>
        </p>

        <Button
          onClick={() => reset()}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    </main>
  );
}
