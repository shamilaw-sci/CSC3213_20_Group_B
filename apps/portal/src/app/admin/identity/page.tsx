import IdentityAdminPage from '@/app/admin/identity/_components/identity-admin-page';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return (
    <IdentityAdminPage
      initialView={view === 'review' ? 'review' : 'mappings'}
    />
  );
}
