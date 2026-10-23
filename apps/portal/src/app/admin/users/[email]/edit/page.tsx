import ManageUserEditPage from '@/app/admin/users/[email]/edit/_components/manage-user-edit-page';
import { loadAdminUser } from '@/lib/server/user';

export default async function Page({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const user = await loadAdminUser(decodeURIComponent(email));

  return <ManageUserEditPage user={user} />;
}
