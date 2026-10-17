import PublicProfilePage from '@/components/custom/public-profile-page/PublicProfilePage';
import { emailPathSegment } from '@/lib/utils';

export default async function Page({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const targetEmail = decodeURIComponent(email);

  return (
    <PublicProfilePage
      targetEmail={targetEmail}
      backHref={`/admin/users/${emailPathSegment(targetEmail)}`}
      backLabel="Back to User"
    />
  );
}
