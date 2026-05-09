export const ALLOWED_CLIENTS: Record<string, boolean> = {
  portal: true,
};

export const REDIRECT_URLS: Record<string, string> = {
  portal: 'https://portal.scs.localhost/dashboard',
};

export const ERROR_REDIRECT_URLS: Record<string, string> = {
  portal: 'https://portal.scs.localhost/login',
};

export const MAGIC_LINK_URLS: Record<string, string> = {
  portal: 'https://portal.scs.localhost/auth/magic-link/verify',
};

export const COOKIE_DOMAIN = '.scs.localhost';

export const COOKIE_MAX_AGE = 60 * 15; // 15 minutes

// NOTE: Keep this time same as the cookie max age to avoid issues with token expiration and cookie expiration mismatch.
export const JWT_EXPIRATION_TIME = '15m'; // 15 minutes

export const ALLOWED_GOOGLE_WORKSPACES_DOMAINS = ['sci.pdn.ac.lk', 'pdn.ac.lk'];

export const ALLOWED_ORIGINS = [
  'https://scs.localhost',
  'https://api.scs.localhost',
  'https://portal.scs.localhost',
  'https://people.scs.localhost',
  'https://projects.scs.localhost',
  'https://github.scs.localhost',
  'http://127.0.0.1:8787',
  'http://127.0.0.1::8788',
];
