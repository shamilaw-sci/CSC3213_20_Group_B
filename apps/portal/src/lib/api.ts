import publicEnvConfig from '@/config/public.env.config';

function apiUrl(path: string) {
  return new URL(path, publicEnvConfig.NEXT_PUBLIC_BASE_API_URL);
}

export function apiHeaders(headers?: HeadersInit) {
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set('X-Client-Id', publicEnvConfig.NEXT_API_CLIENT_ID);
  return mergedHeaders;
}

export interface ApiErrorBody {
  error?: string;
  code?: string;
  message?: string;
}

export async function readApiError(response: Response): Promise<ApiErrorBody> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    return {
      ...body,
      message: body.message ?? body.error ?? response.statusText,
    };
  }

  const text = await response.text().catch(() => '');
  const message = text.trim() || response.statusText || 'Request failed';
  return { error: message, message };
}

export function authEmailSendCodeApiUrl() {
  return apiUrl('/auth/magic-code');
}

export function authEmailVerifyCodeApiUrl() {
  return apiUrl('/auth/magic-code/verify');
}

export function authProviderApiUrl(provider: 'google' | 'github') {
  return apiUrl(`/auth/${provider}`);
}

export function logoutApiUrl() {
  return apiUrl('/auth/logout');
}

export function meApiUrl() {
  return apiUrl('/api/me');
}

export function publicProfileApiUrl() {
  return apiUrl('/api/people/v2/me');
}

export function adminPublicProfileApiUrl(email: string) {
  return apiUrl(`/api/people/v2/admin/users/${encodeURIComponent(email)}`);
}

export function publicProfileSchemaApiUrl() {
  return apiUrl('/api/people/v2/me/schema');
}

export function publicProfileStudentPlacementApiUrl() {
  return apiUrl('/api/people/v2/me/student-placement');
}

export function adminPublicProfileSchemaApiUrl(email: string) {
  return apiUrl(
    `/api/people/v2/admin/users/${encodeURIComponent(email)}/schema`
  );
}

export function adminPublicProfileStudentPlacementApiUrl(email: string) {
  return apiUrl(
    `/api/people/v2/admin/users/${encodeURIComponent(email)}/student-placement`
  );
}

export function adminStudentPlacementMetadataApiUrl() {
  return apiUrl('/api/people/v2/admin/student-placement');
}

export function adminStudentPlacementMetadataPrApiUrl() {
  return apiUrl('/api/people/v2/admin/student-placement/pr');
}

export function adminStudentPlacementMetadataPrCleanupApiUrl() {
  return apiUrl('/api/people/v2/admin/student-placement/pr');
}

export function adminStudentPlacementMetadataPrStatusApiUrl() {
  return apiUrl('/api/people/v2/admin/student-placement/pr');
}

export function publicProfilePrApiUrl() {
  return apiUrl('/api/people/v2/me/pr');
}

export function adminPublicProfilePrApiUrl(email: string) {
  return apiUrl(`/api/people/v2/admin/users/${encodeURIComponent(email)}/pr`);
}

export function userProxyApiUrl() {
  return apiUrl('/user/proxy');
}

export function userProxyReadUrlApiUrl() {
  return apiUrl('/user/proxy/read-url');
}

export function userProxyListApiUrl(page: number) {
  return apiUrl(`/user/proxy/all?page=${encodeURIComponent(String(page))}`);
}

export function userProxyAllReadUrlApiUrl() {
  return apiUrl('/user/proxy/all-url');
}

export function adminUsersApiUrl() {
  return apiUrl('/api/admin/users');
}

export function adminUserApiUrl(email: string) {
  return apiUrl(`/api/admin/users/${encodeURIComponent(email)}`);
}

export function adminActionsApiUrl() {
  return apiUrl('/api/admin/actions');
}

export function adminActionApiUrl(actionId: string) {
  return apiUrl(`/api/admin/actions/${encodeURIComponent(actionId)}`);
}

export function publicProjectsApiUrl() {
  return apiUrl('/api/projects/v2/projects');
}

export function publicProjectApiUrl(slug: string) {
  return apiUrl(`/api/projects/v2/projects/${encodeURIComponent(slug)}`);
}

export function publicProjectSchemaApiUrl(slug: string) {
  return apiUrl(`/api/projects/v2/projects/${encodeURIComponent(slug)}/schema`);
}

export function publicProjectPrApiUrl(slug: string) {
  return apiUrl(`/api/projects/v2/projects/${encodeURIComponent(slug)}/pr`);
}

export function publicCoursesApiUrl() {
  return apiUrl('/api/academic/v2/courses');
}

export function publicCourseApiUrl(id: string) {
  return apiUrl(`/api/academic/v2/courses/${encodeURIComponent(id)}`);
}

export function publicCourseSchemaApiUrl(id: string) {
  return apiUrl(`/api/academic/v2/courses/${encodeURIComponent(id)}/schema`);
}

export function publicCoursePrApiUrl(id: string) {
  return apiUrl(`/api/academic/v2/courses/${encodeURIComponent(id)}/pr`);
}

export function publicOfferingsApiUrl() {
  return apiUrl('/api/academic/v2/offerings');
}

export function publicOfferingApiUrl(id: string) {
  return apiUrl(`/api/academic/v2/offerings/${encodeURIComponent(id)}`);
}

export function publicOfferingPrApiUrl(id: string) {
  return apiUrl(`/api/academic/v2/offerings/${encodeURIComponent(id)}/pr`);
}

export function adminProxyResetAttemptsApiUrl() {
  return apiUrl('/api/admin/proxy/reset-attempts');
}

export function passkeyLoginOptionsApiUrl() {
  return apiUrl('/auth/passkey/login/options');
}

export function passkeyLoginVerifyApiUrl() {
  return apiUrl('/auth/passkey/login/verify');
}

export function passkeyRegisterOptionsApiUrl() {
  return apiUrl('/auth/passkey/register/options');
}

export function passkeyRegisterVerifyApiUrl() {
  return apiUrl('/auth/passkey/register/verify');
}

export function passkeyCredentialsApiUrl() {
  return apiUrl('/auth/passkey/credentials');
}

export function passkeyCredentialApiUrl(credentialId: string) {
  return apiUrl(
    `/auth/passkey/credentials/${encodeURIComponent(credentialId)}`
  );
}

// --- Magic Code Authentication ---

export interface MagicCodeResponse {
  message?: string;
  expiresIn?: number;
  error?: string;
  code?: string;
}

export interface MagicCodeVerifyResult {
  redirectTo?: string;
  error?: string;
}

export async function requestMagicCode(
  email: string
): Promise<MagicCodeResponse> {
  const url = authEmailSendCodeApiUrl();
  const headers = apiHeaders();
  headers.set('Content-Type', 'application/json');

  const res = await fetch(url, {
    method: 'POST',
    headers: Object.fromEntries(headers.entries()),
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const body = await readApiError(res);
    return body as MagicCodeResponse;
  }

  return res.json().catch(() => ({}) as MagicCodeResponse);
}

export async function verifyMagicCode(
  email: string,
  code: string
): Promise<MagicCodeVerifyResult> {
  const url = authEmailVerifyCodeApiUrl();
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('X-Client-Id', publicEnvConfig.NEXT_API_CLIENT_ID);

  const res = await fetch(url, {
    method: 'POST',
    headers: Object.fromEntries(headers.entries()),
    body: JSON.stringify({ email, code }),
    credentials: 'include',
  });

  const body = await res.json().catch(() => ({}));
  return body as MagicCodeVerifyResult;
}
