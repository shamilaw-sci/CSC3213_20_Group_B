import ManageUserPage from '@/app/admin/users/[email]/_components/manage-user-page';
import { loadAdminUser } from '@/lib/server/user';

export default async function Page({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const user = await loadAdminUser(decodeURIComponent(email));

  return <ManageUserPage user={user} />;
}
