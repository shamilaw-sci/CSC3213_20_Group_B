import ManageProxies from '@/views/manage/ManageProxies';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;

  return <ManageProxies cursor={cursor} />;
}
