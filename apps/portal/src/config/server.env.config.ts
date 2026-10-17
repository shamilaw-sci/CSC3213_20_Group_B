interface ServerEnvConfig {
  COOKIE_DOMAIN: string;
}

const serverEnvConfig: ServerEnvConfig = {
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? '.scs-pdn.space',
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
