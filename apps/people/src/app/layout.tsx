import '@scs/ui/styles/theme.css';
import '@/app/globals.css';

import { ThemeProvider } from '@scs/ui/components/theme-provider';
import type { Metadata, Viewport } from 'next';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { openSans } from '@/config/font.config';
import publicEnvConfig from '@/config/public.env.config';

export const metadata: Metadata = {
  title: {
    default: 'SCS PDN People',
    template: '%s | SCS PDN',
  },
  description:
    'Department of Statistics & Computer Science, University of Peradeniya',
  applicationName: 'SCS PDN People',
  keywords: [],
  openGraph: {
    title: 'SCS PDN People',
    description:
      'Department of Statistics & Computer Science, University of Peradeniya',
    url: `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}`,
    siteName: 'SCS PDN People',
    images: [
      {
        url: `${publicEnvConfig.NEXT_PUBLIC_SITE_URL}/images/og.png`,
        width: 1200,
        height: 630,
        alt: 'Department of Statistics & Computer Science, University of Peradeniya',
      },
    ],
    locale: 'en',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'SCS PDN People',
    description:
      'Department of Statistics & Computer Science, University of Peradeniya',
    images: [`${publicEnvConfig.NEXT_PUBLIC_SITE_URL}/images/og.png`],
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
    title: 'SCS PDN People',
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#151317' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${openSans.variable} min-h-svh antialiased`}>
        <ThemeProvider>
          <div className="flex min-h-svh flex-col">
            <SiteHeader />
            <main className="flex flex-1 flex-col">{children}</main>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
