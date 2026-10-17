import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

import baseConfig from './base';

const nextConfig = [...nextTs, ...nextVitals, ...baseConfig];

export default nextConfig;
