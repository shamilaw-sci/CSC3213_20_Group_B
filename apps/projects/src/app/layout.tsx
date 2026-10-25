import '@scs/ui/styles/theme.css';
import '@/app/globals.css';

import { SkipLink } from '@scs/ui/components/skip-link';
import { Toaster } from '@scs/ui/components/sonner';
import { ThemeProvider } from '@scs/ui/components/theme-provider';
import type { Metadata, Viewport } from 'next';
import { Open_Sans } from 'next/font/google';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import publicEnvConfig from '@/config/public.env.config';

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
});

const siteName = 'SCS PDN Projects';
const siteDescription =
  'Search and filter student projects, research, department systems, datasets, open-source work, and collaborations from the Department of Statistics and Computer Science, University of Peradeniya.';
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
          <SkipLink />
          <div className="flex min-h-svh flex-col">
            <SiteHeader />
            <main
              id="main-content"
              tabIndex={-1}
              className="flex flex-1 flex-col"
            >
              {children}
            </main>
            <SiteFooter />
          </div>
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
