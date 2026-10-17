import ms from 'ms';

export const ALLOWED_CLIENTS: Record<string, boolean> = {
  portal: true,
};

export const REDIRECT_URLS: Record<string, string> = {
  portal: 'https://portal.scs-pdn.space/dashboard',
};

export const ERROR_REDIRECT_URLS: Record<string, string> = {
  portal: 'https://portal.scs-pdn.space/login',
};

export const COOKIE_DOMAIN = '.scs-pdn.space';

export const COOKIE_MAX_AGE = 60 * 60 * 5; // 5 hours

// NOTE: Keep this time same as the cookie max age to avoid issues with token expiration and cookie expiration mismatch.

export const JWT_EXPIRATION_TIME: string = ms(COOKIE_MAX_AGE * 1000, {
  long: false,
});

export const ALLOWED_GOOGLE_WORKSPACES_DOMAINS = ['sci.pdn.ac.lk', 'pdn.ac.lk'];

export const ALLOWED_ORIGINS = [
  'https://portal.scs-pdn.space',
  'https://portal.scs.pdn.ac.lk',
];

export const PASSKEY_CHALLENGE_COOKIE = 'passkey_challenge';

export const PASSKEY_CHALLENGE_MAX_AGE = 300;

export const PASSKEY_LIMIT = 4;

export const PASSKEY_RP_NAME = 'SCS Portal';

export const PASSKEY_RP_IDS: Record<string, string> = {
  'https://portal.scs-pdn.space': 'scs-pdn.space',
  'https://portal.scs.pdn.ac.lk': 'portal.scs.pdn.ac.lk',
};

export const PROXY_DEFAULT_AVAILABLE_ATTEMPTS = 5;
export const PROXY_ATTEMPTS_RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

export const PERMISSION_LIST_PAGE_LIMIT = 100;
export const PERMISSION_BATCH_SIZE = 50;
export const MAX_USERS_PER_REQUEST = 1000;

export const PROFILE_NAME_MAX_LENGTH = 100;
export const PROFILE_PICTURE_MAX_LENGTH = 2048;
