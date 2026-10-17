import ManageUser from '@/views/manage/ManageUser';

export default async function Page({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  return <ManageUser email={decodeURIComponent(email)} />;
}
