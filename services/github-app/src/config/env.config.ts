/**
 * Runtime configuration loaded from environment variables.
 */
interface EnvConfig {
  GITHUB_APP_ID: string;
  GITHUB_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_OWNER: string;
  GITHUB_CONFIG_REPOSITORY: string;
  GITHUB_PEOPLE_DATA_REPOSITORY: string;
  GITHUB_PROJECTS_DATA_REPOSITORY: string;
  X_INTERNAL_SECRET: string;
  PORT: number;
}

/**
 * Process environment snapshot used by the service.
 */
const envConfig: EnvConfig = {
  GITHUB_APP_ID: process.env.GITHUB_APP_ID || '',
  GITHUB_PRIVATE_KEY: process.env.GITHUB_PRIVATE_KEY || '',
  GITHUB_INSTALLATION_ID: process.env.GITHUB_INSTALLATION_ID || '',
  GITHUB_OWNER: process.env.GITHUB_OWNER || '',
  GITHUB_CONFIG_REPOSITORY:
    process.env.GITHUB_CONFIG_REPOSITORY || 'config.scs.pdn.ac.lk',
  GITHUB_PEOPLE_DATA_REPOSITORY:
    process.env.GITHUB_PEOPLE_DATA_REPOSITORY ||
    process.env.GITHUB_CONFIG_REPOSITORY ||
    'data.scs.pdn.ac.lk',
  GITHUB_PROJECTS_DATA_REPOSITORY:
    process.env.GITHUB_PROJECTS_DATA_REPOSITORY ||
    process.env.GITHUB_PEOPLE_DATA_REPOSITORY ||
    process.env.GITHUB_CONFIG_REPOSITORY ||
    'data.scs.pdn.ac.lk',
  X_INTERNAL_SECRET: process.env.X_INTERNAL_SECRET || '',
  PORT: parseInt(process.env.PORT || '3000', 10),
};

export default envConfig;
