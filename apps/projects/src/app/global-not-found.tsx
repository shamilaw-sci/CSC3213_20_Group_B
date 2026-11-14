import '@scs/ui/styles/theme.css';
import '@/app/globals.css';

import { buttonVariants } from '@scs/ui/components/button';
import { FeedbackState } from '@scs/ui/components/feedback-state';
import { ThemeInitScript } from '@scs/ui/components/theme-init-script';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { Open_Sans } from 'next/font/google';
import Image from 'next/image';

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '404 - Page Not Found | SCS Projects',
  description: 'The requested project page does not exist.',
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
          title="Project page not found"
          description="The project, course, or category may have moved. Return to discovery to continue browsing."
          actions={
            <>
              {/* A hard navigation remains reliable outside the root app tree. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Global 404 needs a hard navigation outside the app tree. */}
              <a href="/" className={buttonVariants()}>
                <ArrowLeft className="size-4" />
                Browse projects
              </a>
            </>
          }
        />
      </body>
    </html>
  );
}
