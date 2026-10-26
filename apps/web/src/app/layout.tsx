import '@scs/ui/styles/theme.css';
import '@/app/globals.css';

import { SkipLink } from '@scs/ui/components/skip-link';
import { ThemeProvider } from '@scs/ui/components/theme-provider';
import type { Metadata, Viewport } from 'next';
import { Open_Sans, Source_Serif_4 } from 'next/font/google';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import publicEnvConfig from '@/config/public.env.config';
import { themeMetadataColors } from '@/config/theme.config';
import { createPageMetadata } from '@/lib/metadata';

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
});

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
});

const siteDescription =
  'Department of Statistics & Computer Science, University of Peradeniya';
const homeMetadata = createPageMetadata({
  title: 'SCS PDN',
  description: siteDescription,
  path: '/',
});

export const metadata: Metadata = {
  ...homeMetadata,
  title: {
    default: 'SCS PDN',
    template: '%s | SCS PDN',
  },
  description: siteDescription,
  applicationName: 'SCS PDN',
  keywords: [],
  alternates: {
    ...homeMetadata.alternates,
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
    title: 'SCS PDN',
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
        color: themeMetadataColors.maskIcon,
      },
      { rel: 'manifest', url: '/favicon/site.webmanifest' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    {
      media: '(prefers-color-scheme: light)',
      color: themeMetadataColors.light,
    },
    { media: '(prefers-color-scheme: dark)', color: themeMetadataColors.dark },
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
        className={`${openSans.variable} ${sourceSerif.variable} min-h-svh
          antialiased`}
      >
        <ThemeProvider>
          <SkipLink />
          <div className="flex min-h-svh flex-col">
            <SiteHeader />
            <main id="main-content" tabIndex={-1} className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
