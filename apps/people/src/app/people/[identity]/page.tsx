import PersonProfilePage from '@/views/people/PersonProfilePage';

export default async function Page({
  params,
}: {
  params: Promise<{ identity: string }>;
}) {
  const { identity } = await params;
  return <PersonProfilePage identity={identity} />;
}
