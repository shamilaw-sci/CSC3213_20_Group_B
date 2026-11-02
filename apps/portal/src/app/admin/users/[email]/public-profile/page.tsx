import PublicProfileEditor from '@/components/profiles/public-profile-editor';
import { emailPathSegment } from '@/lib/email';
import { loadPublicProfileEditorData } from '@/lib/server/public-profile';
import { loadAdminUser } from '@/lib/server/user';

export default async function Page({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const targetEmail = decodeURIComponent(email);
  await loadAdminUser(targetEmail);
  const initialData = await loadPublicProfileEditorData(targetEmail);

  return (
    <PublicProfileEditor
      initialData={initialData}
      targetEmail={targetEmail}
      backHref={`/admin/users/${emailPathSegment(targetEmail)}`}
      backLabel="Back to User"
    />
  );
}
