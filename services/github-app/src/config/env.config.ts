import { getRuntimeConfig } from '@/config/runtime.config';
import type { GithubAppRuntimeConfig } from '@/types/env';

const envConfig = new Proxy({} as GithubAppRuntimeConfig, {
  get(_target, property: keyof GithubAppRuntimeConfig) {
    return getRuntimeConfig()[property];
  },
});

export default envConfig;
