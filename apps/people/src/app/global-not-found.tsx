import '@scs/ui/styles/theme.css';
import '@/app/globals.css';

import { buttonVariants } from '@scs/ui/components/button';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import { ThemeInitScript } from '@scs/ui/components/theme-init-script';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';

import { openSans } from '@/config/font.config';

export const metadata: Metadata = {
  title: '404 - Page Not Found | SCS People',
  description: 'The requested person or page does not exist.',
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
          icon={
            <Image
              src="/favicon/logo-symbol-icon.svg"
              alt=""
              width={72}
              height={72}
            />
          }
          title="Person or page not found"
          description="Check the address, or return to the directory to find staff and students."
          actions={
            <>
              {/* A hard navigation remains reliable outside the root app tree. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className={buttonVariants()}>
                <ArrowLeft className="size-4" />
                Browse people
              </a>
            </>
          }
        />
      </body>
    </html>
  );
}
