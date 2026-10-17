import './globals.css';

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
    <html lang="en" className="h-full">
      <body
        className={`${openSans.variable} h-full bg-gray-50 flex items-center justify-center`}
      >
        <div className="text-center px-6">
          <h1 className="text-7xl font-bold text-gray-900">404</h1>
          <h2 className="mt-4 text-2xl font-semibold text-gray-700">
            Page Not Found
          </h2>
          <p className="mt-4 text-gray-500 max-w-md mx-auto">
            Oops! The page you're looking for doesn't exist or has been moved.
            Please check the URL or return to the home page.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="inline-block mt-6 rounded-lg bg-black px-6 py-3 text-white text-sm font-medium hover:bg-gray-800 transition"
          >
            Go Back Home
          </a>
        </div>
      </body>
    </html>
  );
}
