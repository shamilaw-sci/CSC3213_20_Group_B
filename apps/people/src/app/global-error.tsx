'use client';

import './globals.css';

import { RefreshCw } from 'lucide-react';
import { Open_Sans } from 'next/font/google';
import Image from 'next/image';

import { ThemeInitScript } from '@/components/custom/theme/theme-init-script';
import { Button } from '@/components/ui/button';

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
      className={`${openSans.variable} antialiased`}
    >
      <head>
        <ThemeInitScript />
      </head>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
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
                href="mailto:issues@sivothajan.me"
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
        </div>
      </body>
    </html>
  );
}
