'use client';

import './globals.css';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Open_Sans } from 'next/font/google';

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
    <html lang="en" className="h-full">
      <body
        className={`${openSans.variable} antialiased h-full bg-gray-50 flex items-center justify-center`}
      >
        <div className="text-center px-6 max-w-lg">
          <div className="flex justify-center mb-6">
            <div className="bg-red-100 p-4 rounded-full">
              <AlertTriangle className="h-10 w-10 text-red-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            Critical System Failure
          </h2>
          <p className="mt-4 text-gray-600">
            A fatal error has occurred, causing the system to crash. Please try
            rebooting the system. If the issue persists, contact
            <a
              href="mailto:issues@scs.pdn.ac.lk"
              className="text-blue-600 underline hover:text-blue-800 ml-1"
            >
              issues@scs.pdn.ac.lk
            </a>
            for support.
          </p>
          <p className="mt-3 text-sm text-red-600 wrap-break-word">
            Error: {error.message}
          </p>
          <div className="mt-6">
            <Button
              onClick={() => reset()}
              className="inline-flex items-center"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reboot System
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
