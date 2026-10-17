interface PublicEnvConfig {
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_PROJECTS_DATA_BASE_URL: string;
  NEXT_PUBLIC_PEOPLE_SITE_URL: string;
}

const publicEnvConfig: PublicEnvConfig = {
  NEXT_PUBLIC_SITE_URL:
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://projects.scs-pdn.space',
  NEXT_PUBLIC_PROJECTS_DATA_BASE_URL:
    process.env.NEXT_PUBLIC_PROJECTS_DATA_BASE_URL ??
    'https://data.scs-pdn.space/projects/v2',
  NEXT_PUBLIC_PEOPLE_SITE_URL:
    process.env.NEXT_PUBLIC_PEOPLE_SITE_URL ?? 'https://people.scs-pdn.space',
};

export default publicEnvConfig;
