import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { ErrorPageFlag } from '@/components/custom/theme/error-page-flag';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background text-foreground antialiased">
      <ErrorPageFlag />
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
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back Home
        </Link>
      </div>
    </main>
  );
}
