import publicEnvConfig from '@/config/public.env.config';

export const authConfig = {
  magicCode: {
    length: publicEnvConfig.NEXT_PUBLIC_VERIFICATION_CODE_MAX_LENGTH,
    resendCooldownMs: 30_000,
    fallbackExpiresInSeconds: 300,
  },
  passkey: {
    maxCredentials: 4,
    maxNameLength: 64,
  },
} as const;
