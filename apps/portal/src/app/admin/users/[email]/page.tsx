import ManageUserPage from '@/components/custom/manage-user-page/ManageUserPage';
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
