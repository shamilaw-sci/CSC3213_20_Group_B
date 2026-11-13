export const ALLOWED_CLIENTS: Record<string, boolean> = {
  portal: true,
};

export const COOKIE_DOMAIN = '.scs-pdn.space';

export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 5;

export const ALLOWED_ORIGINS = [
  'https://portal.scs-pdn.space',
  'https://portal.scs.pdn.ac.lk',
];

export const PASSKEY_RP_NAME = 'SCS Portal';

export const PASSKEY_RP_IDS: Record<string, string> = {
  'https://portal.scs-pdn.space': 'scs-pdn.space',
  'https://portal.scs.pdn.ac.lk': 'portal.scs.pdn.ac.lk',
};

export const PROXY_DEFAULT_AVAILABLE_ATTEMPTS = 5;
export const PROXY_ATTEMPTS_RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

export const PROFILE_NAME_MAX_LENGTH = 100;
export const PROFILE_PICTURE_MAX_LENGTH = 2048;
