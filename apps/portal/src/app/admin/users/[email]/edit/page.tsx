import ManageUserEditPage from '@/components/custom/manage-user-edit-page/ManageUserEditPage';
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
