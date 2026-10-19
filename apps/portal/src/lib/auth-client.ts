'use client';

import { passkeyClient } from '@better-auth/passkey/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import publicEnvConfig from '@/config/public.env.config';

export const authClient = createAuthClient({
  baseURL: publicEnvConfig.NEXT_PUBLIC_BASE_API_URL,
  basePath: '/api/auth',
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [emailOTPClient(), passkeyClient()],
});
