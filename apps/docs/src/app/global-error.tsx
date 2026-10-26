'use client';

import '@/app/globals.css';

import { Button } from '@scs/ui/components/button';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import { ThemeInitScript } from '@scs/ui/components/theme-init-script';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => console.error(error), [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body
        className="bg-fd-background text-fd-foreground flex min-h-screen
          items-center"
      >
        <FeedbackState
          title="The documentation site needs to recover"
          description="Reload the site. If the problem continues, report it to the repository maintainers."
          actions={
            <Button type="button" onClick={reset}>
              Try again
            </Button>
          }
        />
      </body>
    </html>
  );
}
