import './globals.css';

import { Toaster } from '@scs/ui/sonner';
import type { Metadata, Viewport } from 'next';
import { Open_Sans } from 'next/font/google';

import Navbar from '@/components/custom/navbar/Navbar';
import { ThemeProvider } from '@/components/custom/theme/theme-provider';
import publicEnvConfig from '@/config/public.env.config';

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
});

const siteName = 'SCS PDN Projects';
const siteDescription =
  'Browse student projects, research work, department systems, datasets, open-source tools, and collaborations from the Department of Statistics and Computer Science, University of Peradeniya.';
const ogImage = `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}/images/science-projects-hero.png`;

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: [
    'SCS projects',
    'University of Peradeniya',
    'Department of Statistics and Computer Science',
    'student projects',
    'research projects',
    'department systems',
    'datasets',
  ],
  openGraph: {
    title: siteName,
    description: siteDescription,
    url: `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}`,
    siteName,
    images: [
      {
        url: ogImage,
        width: 1536,
        height: 1024,
        alt: 'SCS projects and academic work',
      },
    ],
    locale: 'en',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description: siteDescription,
    images: [ogImage],
    creator: 'SCS PDN',
  },

  alternates: {
    canonical: `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}`,
    languages: {
      en: `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}`,
    },
    types: {
      'application/atom+xml': `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}/feed.xml`,
      'application/json': `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}/feed.json`,
      'application/rss+xml': `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}/rss.xml`,
    },
  },

  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },

  appleWebApp: {
    capable: true,
    title: siteName,
    startupImage: '/favicon/apple-touch-icon.png',
    statusBarStyle: 'default',
  },

  manifest: '/favicon/site.webmanifest',

  icons: {
    icon: [
      { url: '/favicon/favicon.ico' },
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/favicon-42x42.png', sizes: '42x42', type: 'image/png' },
      { url: '/favicon/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      {
        url: '/favicon/favicon-16x16.webp',
        sizes: '16x16',
        type: 'image/webp',
      },
      {
        url: '/favicon/favicon-32x32.webp',
        sizes: '32x32',
        type: 'image/webp',
      },
      {
        url: '/favicon/favicon-42x42.webp',
        sizes: '42x42',
        type: 'image/webp',
      },
      {
        url: '/favicon/favicon-48x48.webp',
        sizes: '48x48',
        type: 'image/webp',
      },
    ],
    apple: [
      { url: '/favicon/apple-touch-icon-57x57.png', sizes: '57x57' },
      { url: '/favicon/apple-touch-icon-60x60.png', sizes: '60x60' },
      { url: '/favicon/android-chrome-72x72.png', sizes: '72x72' },
      { url: '/favicon/apple-touch-icon-76x76.png', sizes: '76x76' },
      { url: '/favicon/apple-touch-icon-114x114.png', sizes: '114x114' },
      { url: '/favicon/apple-touch-icon-120x120.png', sizes: '120x120' },
      { url: '/favicon/android-chrome-144x144.png', sizes: '144x144' },
      { url: '/favicon/apple-touch-icon-152x152.png', sizes: '152x152' },
      { url: '/favicon/apple-touch-icon-167x167.png', sizes: '167x167' },
      { url: '/favicon/apple-touch-icon-180x180.png', sizes: '180x180' },
      { url: '/favicon/apple-touch-icon-1024x1024.png', sizes: '1024x1024' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/favicon/logo-symbol-icon.svg',
        color: '#020617',
      },
      { rel: 'manifest', url: '/favicon/site.webmanifest' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'white' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${openSans.variable} flex min-h-screen flex-col antialiased`}
      >
        <ThemeProvider>
          <Navbar />

          <main className="flex flex-1 flex-col">{children}</main>

          <footer className="border-t bg-muted/30">
            <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-muted-foreground">
              <p>
                <a
                  href="https://scs-pdn.space"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-primary"
                >
                  Department of Statistics &amp; Computer Science
                </a>
              </p>
              <p className="mt-1">
                <a
                  href="https://sci.pdn.ac.lk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-primary"
                >
                  Faculty of Science
                </a>
                {' - '}
                <a
                  href="https://www.pdn.ac.lk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-primary"
                >
                  University of Peradeniya
                </a>
              </p>
            </div>
          </footer>

          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
