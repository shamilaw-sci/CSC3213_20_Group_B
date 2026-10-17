export const auth_error_messages: Record<string, string> = {
  // login / signup
  user_not_registered: 'No account found. Please sign up first.',
  user_already_exists: 'Account already exists. Please log in.',
  user_blacklisted: 'Your account has been disabled.',

  // oauth
  google_access_denied: 'Google login was cancelled.',
  google_oauth_not_allowed: 'Google login is not allowed for this account.',
  workspace_account_required: 'Use your university Google account.',

  // github
  github_account_mismatch: 'This GitHub account is not linked to your account.',
  no_valid_email: 'No valid university email found on GitHub.',
  multiple_valid_emails: 'Multiple university emails detected on GitHub.',

  // system
  token_exchange_failed: 'Login failed while contacting OAuth provider.',
  invalid_id_token: 'Invalid authentication response.',
  session_creation_failed: 'Failed to create session. Please try again.',
  invalid_session: 'Your session has expired. Please log in again.',

  // generic
  clear_cookies_failed:
    'Failed to clear session cookies. Please clear them manually and try again.',
  // passkey / WebAuthn
  passkey_no_credentials:
    'No saved passkey found for this account. Try Email or sign up to create one.',
  passkey_not_allowed: 'Passkey login is not allowed for this account.',
  passkey_bad_request: 'Passkey request was invalid. Please try again.',
  passkey_cancelled:
    'Passkey selection cancelled. Try again or use another method.',
  passkey_limit_reached: 'You can save up to 4 passkeys for this account.',
  passkey_name_conflict:
    'Passkey name already in use. Try another name or leave it blank to use a default name.',

  // magic-code
  magic_code_missing: 'Please enter the verification code sent to your email.',
  magic_code_invalid:
    'The code is invalid or has expired. Please request a new one.',

  // server-side data fetch failures
  fetch_failed: 'Failed to load data. Please try again.',
};
