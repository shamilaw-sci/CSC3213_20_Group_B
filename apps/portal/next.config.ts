import path from 'node:path';

import type { NextConfig } from 'next';

const isDocker = process.env.DOCKER === 'true';

const nextConfig: NextConfig = {
  experimental: {
    globalNotFound: true,
  },
  output: isDocker ? 'standalone' : undefined,
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
