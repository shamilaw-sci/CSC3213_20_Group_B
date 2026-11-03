import '@scs/ui/styles/theme.css';
import '@/app/globals.css';

import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata, Viewport } from 'next';
import { Open_Sans, Source_Serif_4 } from 'next/font/google';
import type { ReactNode } from 'react';

import { DocsSearchDialog } from '@/components/search/docs-search-dialog';
import { WebMcpTools } from '@/components/webmcp-tools';
import { siteConfig } from '@/config/site.config';
import { themeMetadataColors } from '@/config/theme.config';
import { source } from '@/lib/source';

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
});

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: siteConfig.origin,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: { canonical: siteConfig.origin },
  openGraph: {
    type: 'website',
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.origin,
    siteName: siteConfig.name,
    images: [
      {
        url: '/favicon/android-chrome-512x512.png',
        width: 512,
        height: 512,
        alt: 'Department of Statistics & Computer Science, University of Peradeniya',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: siteConfig.name,
    description: siteConfig.description,
    images: ['/favicon/android-chrome-512x512.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
    startupImage: '/favicon/apple-touch-icon-180x180.png',
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
    {
      media: '(prefers-color-scheme: dark)',
      color: themeMetadataColors.dark,
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <RootProvider search={{ SearchDialog: DocsSearchDialog }}>
          <WebMcpTools
            guides={source.getPages().map((page) => ({
              title: page.data.title,
              url: page.url,
              description: page.data.description,
            }))}
          />
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
