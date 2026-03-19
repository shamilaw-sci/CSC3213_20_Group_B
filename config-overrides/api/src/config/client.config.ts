import ms from 'ms';

export const ALLOWED_CLIENTS: Record<string, boolean> = {
  portal: true,
};

export const REDIRECT_URLS: Record<string, string> = {
  portal: 'http://localhost:3002/dashboard',
};

export const ERROR_REDIRECT_URLS: Record<string, string> = {
  portal: 'http://localhost:3002/login',
};

export const COOKIE_DOMAIN = 'localhost';

export const COOKIE_MAX_AGE = 60 * 15; // 15 minutes

// NOTE: Keep this time same as the cookie max age to avoid issues with token expiration and cookie expiration mismatch.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const JWT_EXPIRATION_TIME: string = ms(COOKIE_MAX_AGE * 1000, {
  long: false,
});

export const ALLOWED_GOOGLE_WORKSPACES_DOMAINS = ['sci.pdn.ac.lk', 'pdn.ac.lk'];

export const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
];
