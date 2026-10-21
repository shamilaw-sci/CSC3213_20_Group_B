export const auth_error_messages: Record<string, string> = {
  // Login and signup
  user_not_registered: 'No account found. Please sign up first.',
  user_already_exists: 'Account already exists. Please log in.',
  user_blacklisted: 'Your account has been disabled.',

  // OAuth providers
  google_access_denied: 'Google login was cancelled.',
  google_oauth_not_allowed: 'Google login is not allowed for this account.',
  workspace_account_required: 'Use your university Google account.',
  account_not_linked:
    'This sign-in method is not linked. Use your verified university email or an existing provider, then link it in Account Settings.',

  // GitHub account policy
  github_account_mismatch: 'This GitHub account is not linked to your account.',
  no_valid_email: 'No valid university email found on GitHub.',
  multiple_valid_emails: 'Multiple university emails detected on GitHub.',

  // Session and token handling
  token_exchange_failed: 'Login failed while contacting OAuth provider.',
  invalid_id_token: 'Invalid authentication response.',
  session_creation_failed: 'Failed to create session. Please try again.',
  invalid_session: 'Your session has expired. Please log in again.',

  // Generic session cleanup
  clear_cookies_failed:
    'Failed to clear session cookies. Please clear them manually and try again.',
  // Passkeys and WebAuthn
  passkey_no_credentials:
    'No saved passkey found for this account. Try Email or sign up to create one.',
  passkey_not_allowed: 'Passkey login is not allowed for this account.',
  passkey_bad_request: 'Passkey request was invalid. Please try again.',
  passkey_cancelled:
    'Passkey selection cancelled. Try again or use another method.',
  passkey_limit_reached: 'You can save up to 4 passkeys for this account.',
  passkey_name_conflict:
    'Passkey name already in use. Try another name or leave it blank to use a default name.',

  // Email verification codes
  magic_code_missing: 'Please enter the verification code sent to your email.',
  magic_code_invalid:
    'The code is invalid or has expired. Please request a new one.',

  // Server-side data loading
  fetch_failed: 'Failed to load data. Please try again.',
};
