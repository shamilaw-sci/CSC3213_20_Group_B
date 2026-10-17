import EditManageUser from '@/views/manage/EditManageUser';

export default async function Page({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  return <EditManageUser email={decodeURIComponent(email)} />;
}
