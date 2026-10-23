import '@/app/globals.css';

import { Button } from '@scs/ui/components/button';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import { ThemeInitScript } from '@scs/ui/components/theme-init-script';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { Open_Sans } from 'next/font/google';

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '404 - Page Not Found | SCS PDN',
  description: 'The page you are looking for does not exist.',
};

export default function GlobalNotFound() {
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
          code="404"
          title="Page not found"
          description="The address may be incorrect, or the page may have moved."
          actions={
            <Button asChild>
              {/* A hard navigation remains reliable outside the root app tree. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/">
                <ArrowLeft className="size-4" />
                Return to SCS home
              </a>
            </Button>
          }
        />
      </body>
    </html>
  );
}
