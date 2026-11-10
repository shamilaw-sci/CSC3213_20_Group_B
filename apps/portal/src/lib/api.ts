import publicEnvConfig from '@/config/public.env.config';
import { isRecord } from '@/lib/is-record';

export function apiUrl(path: string) {
  return new URL(path, publicEnvConfig.NEXT_PUBLIC_BASE_API_URL);
}

export function apiHeaders(headers?: HeadersInit) {
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set('X-Client-Id', publicEnvConfig.NEXT_PUBLIC_API_CLIENT_ID);
  return mergedHeaders;
}

export interface ApiErrorBody {
  error?: string;
  code?: string;
  message?: string;
  field?: string;
  reason?: string;
}

const MAX_ERROR_MESSAGE_LENGTH = 500;

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function fallbackApiError(response: Response): ApiErrorBody {
  const message = `Request failed with status ${response.status}`;
  return { error: message, message };
}

export async function readApiError(response: Response): Promise<ApiErrorBody> {
  const contentType = (
    response.headers.get('content-type') ?? ''
  ).toLowerCase();

  if (contentType.includes('application/json')) {
    const body: unknown = await response.json().catch(() => null);
    if (!isRecord(body)) return fallbackApiError(response);

    const error = boundedString(body.error, MAX_ERROR_MESSAGE_LENGTH);
    const message =
      boundedString(body.message, MAX_ERROR_MESSAGE_LENGTH) ?? error;
    if (!message) return fallbackApiError(response);
    const code = boundedString(body.code, 128);
    const field = boundedString(body.field, 200);
    const reason = boundedString(body.reason, MAX_ERROR_MESSAGE_LENGTH);

    return {
      ...(error ? { error } : {}),
      ...(code ? { code } : {}),
      message,
      ...(field ? { field } : {}),
      ...(reason ? { reason } : {}),
    };
  }

  if (contentType.startsWith('text/plain')) {
    const text = await response.text().catch(() => '');
    const message = boundedString(text, MAX_ERROR_MESSAGE_LENGTH);
    if (message) return { error: message, message };
  }

  return fallbackApiError(response);
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
  return apiUrl('/api/me/proxy');
}

export function adminProxiesPageApiUrl(cursor?: string, limit = 100) {
  const url = apiUrl('/api/admin/proxies/page');
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  return url;
}

export function adminUsersPageApiUrl(cursor?: string, limit = 50) {
  const url = apiUrl('/api/admin/users/page');
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  return url;
}

export function adminUserApiUrl(email: string) {
  return apiUrl(`/api/admin/users/${encodeURIComponent(email)}`);
}

export function adminUserAvatarApiUrl(email: string) {
  return apiUrl(`/api/admin/users/${encodeURIComponent(email)}/avatar`);
}

export function adminAvatarRateResetApiUrl() {
  return apiUrl('/api/admin/avatar-rate/reset');
}

export function adminAvatarReviewsPageApiUrl(cursor?: string, limit = 50) {
  const url = apiUrl('/api/admin/avatar-reviews/page');
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  return url;
}

export function adminAvatarReviewApiUrl(id: string) {
  return apiUrl(`/api/admin/avatar-reviews/${encodeURIComponent(id)}`);
}

export function adminAvatarReviewImageApiUrl(id: string) {
  return apiUrl(`/api/admin/avatar-reviews/${encodeURIComponent(id)}/image`);
}

export function publicProjectsPageApiUrl(cursor?: string, limit = 24) {
  const url = apiUrl('/api/projects/v2/projects/page');
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  return url;
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

export function publicProjectSourcePreviewApiUrl(slug: string) {
  return apiUrl(
    `/api/projects/v2/projects/${encodeURIComponent(slug)}/source-preview`
  );
}

export function publicCoursesApiUrl() {
  return apiUrl('/api/academic/v2/courses');
}

export function publicCoursesPageApiUrl(cursor?: string, limit = 24) {
  const url = apiUrl('/api/academic/v2/courses/page');
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  return url;
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

export function publicOfferingPrApiUrl(id: string) {
  return apiUrl(`/api/academic/v2/offerings/${encodeURIComponent(id)}/pr`);
}

export function adminProxyResetAttemptsApiUrl() {
  return apiUrl('/api/admin/proxies/reset-attempts');
}
