import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';

import baseConfig from '@scs/eslint-config/base';

const nextConfig = [
  ...nextTs,
  ...nextVitals,
  ...baseConfig,
  betterTailwindcss.configs.correctness,
  {
    files: ['postcss.config.mts'],
    rules: {
      // The plugin misclassifies a named `.mts` default export as type-only.
      'unused-imports/no-unused-vars': 'off',
    },
  },
];

export default nextConfig;
