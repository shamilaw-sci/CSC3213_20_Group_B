export interface GithubAppEnv {
  GITHUB_APP_ID: string;
  GITHUB_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_OWNER: string;
  GITHUB_CONFIG_REPOSITORY: string;
  GITHUB_PEOPLE_DATA_REPOSITORY: string;
  GITHUB_PROJECTS_DATA_REPOSITORY: string;
  X_INTERNAL_SECRET: string;
  PORT?: number | string;
}

export interface GithubAppRuntimeConfig extends Omit<GithubAppEnv, 'PORT'> {
  PORT: number;
}
