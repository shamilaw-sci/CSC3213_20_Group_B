import DevPage from '@/components/feedback/development-page';
import { loadAdminUser } from '@/lib/server/user';

export default async function Page({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const targetEmail = decodeURIComponent(email);
  await loadAdminUser(targetEmail);

  return <DevPage />;
}
