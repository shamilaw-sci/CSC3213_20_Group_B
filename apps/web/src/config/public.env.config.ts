interface PublicEnvConfig {
  NEXT_PUBLIC_SITE_URL: string;
}

const publicEnvConfig: PublicEnvConfig = {
  NEXT_PUBLIC_SITE_URL:
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://scs.pdn.ac.lk',
};

export default publicEnvConfig;
