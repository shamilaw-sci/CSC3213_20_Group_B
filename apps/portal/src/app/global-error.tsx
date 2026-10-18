'use client';

import './globals.css';

import { Button } from '@scs/ui/components/button';
import { RefreshCw } from 'lucide-react';
import { Open_Sans } from 'next/font/google';
import Image from 'next/image';

import { ThemeInitScript } from '@/components/custom/theme/theme-init-script';

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${openSans.variable} h-full antialiased`}
    >
      <head>
        <ThemeInitScript />
      </head>
      <body className="flex h-full items-center justify-center bg-background p-4 text-foreground">
        <div className="w-full max-w-md rounded-md border bg-card p-8 text-center text-card-foreground shadow-2xl">
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
              href="mailto:issues@scs.pdn.ac.lk"
              className="text-primary underline"
            >
              issues@scs.pdn.ac.lk
            </a>{' '}
            for support.
            <br />
            <span className="mt-2 inline-block rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              Error: {error.message}
            </span>
          </p>

          <Button onClick={() => reset()} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </body>
    </html>
  );
}
