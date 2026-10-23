'use client';

import '@/app/globals.css';

import { Button } from '@scs/ui/components/button';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import { ThemeInitScript } from '@scs/ui/components/theme-init-script';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Open_Sans } from 'next/font/google';
import { useEffect } from 'react';

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
});

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => console.error(error), [error]);

  return (
    <html
      lang="en"
      className={`${openSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript />
      </head>
      <body
        className="bg-background text-foreground flex min-h-full items-center"
      >
        <FeedbackState
          icon={<AlertTriangle className="size-10" />}
          title="The SCS website needs to recover"
          description="Try loading the website again. If the problem continues, contact issues@scs.pdn.ac.lk."
          actions={
            <Button type="button" onClick={reset}>
              <RefreshCw className="size-4" />
              Try again
            </Button>
          }
        />
      </body>
    </html>
  );
}
