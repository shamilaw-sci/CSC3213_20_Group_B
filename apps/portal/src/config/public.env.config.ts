interface PublicEnvConfig {
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_BASE_API_URL: string;
  NEXT_PUBLIC_PEOPLE_DATA_BASE_URL: string;
  NEXT_VERIFICATION_CODE_MAX_LENGTH: number;
  NEXT_DEFAULT_AVAILABLE_ATTEMPTS: number;
  NEXT_API_CLIENT_ID: string;
}

const publicEnvConfig: PublicEnvConfig = {
  NEXT_PUBLIC_SITE_URL:
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portal.scs-pdn.space',
  NEXT_PUBLIC_BASE_API_URL:
    process.env.NEXT_PUBLIC_BASE_API_URL ?? 'https://api.scs-pdn.space',
  NEXT_PUBLIC_PEOPLE_DATA_BASE_URL:
    process.env.NEXT_PUBLIC_PEOPLE_DATA_BASE_URL ??
    'https://data.scs-pdn.space/people/v2',
  NEXT_VERIFICATION_CODE_MAX_LENGTH: Number(
    process.env.NEXT_VERIFICATION_CODE_MAX_LENGTH ?? 6
  ),
  NEXT_DEFAULT_AVAILABLE_ATTEMPTS: Number(
    process.env.NEXT_DEFAULT_AVAILABLE_ATTEMPTS ?? 5
  ),
  NEXT_API_CLIENT_ID: process.env.NEXT_API_CLIENT_ID ?? 'portal',
};

export default publicEnvConfig;
