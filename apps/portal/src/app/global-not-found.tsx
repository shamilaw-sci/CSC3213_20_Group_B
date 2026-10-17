import './globals.css';

import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { Open_Sans } from 'next/font/google';
import Image from 'next/image';

import { ThemeInitScript } from '@/components/custom/theme/theme-init-script';

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
      suppressHydrationWarning
      className={`${openSans.variable} h-full antialiased`}
    >
      <head>
        <ThemeInitScript />
      </head>
      <body className="flex h-full flex-col items-center justify-center bg-background text-foreground antialiased">
        <div className="flex max-w-md flex-col items-center px-4 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-3xl" />
            <div className="relative h-24 w-24">
              <Image
                src="/favicon/logo-symbol-icon.svg"
                alt="University of Peradeniya"
                width={96}
                height={96}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
          <h1 className="mb-2 text-6xl font-bold tracking-tighter text-foreground">
            404
          </h1>
          <h2 className="mb-4 text-2xl font-semibold text-muted-foreground">
            Page Not Found
          </h2>
          <p className="mb-8 text-base leading-relaxed text-muted-foreground">
            This page is not available. Check the address or return home.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back Home
          </a>
        </div>
      </body>
    </html>
  );
}
