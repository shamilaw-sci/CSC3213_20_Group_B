interface ServerEnvConfig {
  BASE_DOMAIN: string;
  MOODLE_URL: string;
  WORKER_URL: string;
  CF_SECRET: string;
}

const serverEnvConfig: ServerEnvConfig = {
  BASE_DOMAIN: process.env.BASE_DOMAIN ?? 'scs.pdn.ac.lk',
  MOODLE_URL: process.env.MOODLE_URL ?? 'https://scilms.pdn.ac.lk',
  WORKER_URL:
    process.env.WORKER_URL ?? 'https://scs-proxy-worker.scs-pdn.workers.dev',
  CF_SECRET: process.env.CF_SECRET ?? 'default_secret_value',
};

/* ENV VALIDATION FOR SERVER */
const checkServerConfig = (config: ServerEnvConfig) => {
  const missing = Object.entries(config)
    .filter(
      ([, value]) =>
        typeof value === 'string' &&
        (!value ||
          value.trim() === '' ||
          value === 'undefined' ||
          value === 'null')
    )
    .map(([key]) => key);

  if (missing.length) {
    console.error(
      `Missing server environment variables: ${missing.join(', ')}\n` +
        `Please set them in your environment before running the application.\n`
    );
    throw new Error(
      'Missing server environment variables: ' + missing.join(', ')
    );
  }
};

checkServerConfig(serverEnvConfig);

export default serverEnvConfig;
