import {
  type AdminAvatarDeleteResult,
  AdminAvatarDeleteResultSchema,
  type AdminAvatarReviewDecision,
  AdminAvatarReviewDecisionSchema,
  type AdminUserAvatar,
  AdminUserAvatarSchema,
} from '@scs/schemas';

import {
  adminAvatarReviewApiUrl,
  adminAvatarReviewImageApiUrl,
  adminUserAvatarApiUrl,
  apiHeaders,
  readApiError,
} from '@/lib/api';

function unexpectedResponse(): Error {
  return new Error('Received an unexpected response from the avatar service.');
}

export async function getAdminUserAvatar(
  email: string
): Promise<AdminUserAvatar> {
  const response = await fetch(adminUserAvatarApiUrl(email), {
    cache: 'no-store',
    credentials: 'include',
    headers: apiHeaders(),
  });
  if (!response.ok) {
    const error = await readApiError(response);
    throw new Error(
      error.message ?? 'Could not load the public picture details.'
    );
  }
  const parsed = AdminUserAvatarSchema.safeParse(await response.json());
  if (!parsed.success) throw unexpectedResponse();
  return parsed.data;
}

export async function deleteAdminUserAvatar(
  email: string,
  note?: string
): Promise<AdminAvatarDeleteResult> {
  const response = await fetch(adminUserAvatarApiUrl(email), {
    method: 'DELETE',
    credentials: 'include',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ note: note?.trim() || undefined }),
  });
  if (!response.ok) {
    const error = await readApiError(response);
    throw new Error(error.message ?? 'Could not remove the public picture.');
  }
  const parsed = AdminAvatarDeleteResultSchema.safeParse(await response.json());
  if (!parsed.success) throw unexpectedResponse();
  return parsed.data;
}

export async function decideAdminAvatarReview(
  id: string,
  action: 'approve' | 'reject',
  note?: string
): Promise<AdminAvatarReviewDecision> {
  const response = await fetch(adminAvatarReviewApiUrl(id), {
    method: 'POST',
    credentials: 'include',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ action, note: note?.trim() || undefined }),
  });
  if (!response.ok) {
    const error = await readApiError(response);
    throw new Error(error.message ?? 'Could not update the avatar review.');
  }
  const parsed = AdminAvatarReviewDecisionSchema.safeParse(
    await response.json()
  );
  if (!parsed.success) throw unexpectedResponse();
  return parsed.data;
}

export async function fetchAdminAvatarReviewImage(id: string): Promise<Blob> {
  const response = await fetch(adminAvatarReviewImageApiUrl(id), {
    cache: 'no-store',
    credentials: 'include',
    headers: apiHeaders(),
  });
  if (!response.ok) throw new Error('Could not load the review image.');
  return response.blob();
}
