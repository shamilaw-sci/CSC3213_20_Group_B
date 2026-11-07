import { AdminUserPublicAvatarPage } from '@/app/admin/users/[email]/_components/admin-user-public-avatar-page';
import { emailPathSegment } from '@/lib/email';
import { loadAdminUser } from '@/lib/server/user';

export default async function Page({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const targetEmail = decodeURIComponent(email);
  const user = await loadAdminUser(targetEmail);

  return (
    <AdminUserPublicAvatarPage
      backHref={`/admin/users/${emailPathSegment(targetEmail)}/public-profile`}
      email={targetEmail}
      name={user.name}
    />
  );
}
