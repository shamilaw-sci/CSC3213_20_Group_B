import ms from 'ms';

export const ALLOWED_CLIENTS: Record<string, boolean> = {
  portal: true,
};

export const REDIRECT_URLS: Record<string, string> = {
  portal: 'https://portal.scs.localhost/dashboard',
};

export const ERROR_REDIRECT_URLS: Record<string, string> = {
  portal: 'https://portal.scs.localhost/login',
};

export const COOKIE_DOMAIN = 'scs.localhost';

export const COOKIE_MAX_AGE = 60 * 60 * 5; // 5 hours

// Keep this time same as the cookie max age to avoid token/cookie mismatch.
export const JWT_EXPIRATION_TIME: string = ms(COOKIE_MAX_AGE * 1000, {
  long: false,
});

export const ALLOWED_GOOGLE_WORKSPACES_DOMAINS = ['sci.pdn.ac.lk', 'pdn.ac.lk'];

export const ALLOWED_ORIGINS = [
  'https://scs.localhost',
  'https://api.scs.localhost',
  'https://portal.scs.localhost',
  'https://people.scs.localhost',
  'https://projects.scs.localhost',
  'https://github.scs.localhost',
  'https://config.scs.localhost',
  'https://data.scs.localhost',
  'https://mailer.scs.localhost',
];

export const PASSKEY_CHALLENGE_COOKIE = 'passkey_challenge';

export const PASSKEY_CHALLENGE_MAX_AGE = 300;

export const PASSKEY_LIMIT = 4;

export const PASSKEY_RP_NAME = 'SCS Portal';

export const PASSKEY_RP_IDS: Record<string, string> = {
  'https://portal.scs.localhost': 'scs.localhost',
};

export const PROXY_DEFAULT_AVAILABLE_ATTEMPTS = 5;
export const PROXY_ATTEMPTS_RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

export const PERMISSION_LIST_PAGE_LIMIT = 100;
export const PERMISSION_BATCH_SIZE = 50;
export const MAX_USERS_PER_REQUEST = 1000;

export const PROFILE_NAME_MAX_LENGTH = 100;
export const PROFILE_PICTURE_MAX_LENGTH = 2048;
