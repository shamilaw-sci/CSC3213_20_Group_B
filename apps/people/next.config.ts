import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@t3-oss/env-nextjs', '@t3-oss/env-core'],
  experimental: {
    globalNotFound: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
};

export default nextConfig;
