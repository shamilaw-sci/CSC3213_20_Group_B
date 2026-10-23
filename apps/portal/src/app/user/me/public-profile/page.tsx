import PublicProfileEditor from '@/components/profiles/public-profile-editor';
import { loadPublicProfileEditorData } from '@/lib/server/public-profile';

export default async function Page() {
  const initialData = await loadPublicProfileEditorData();

  return <PublicProfileEditor initialData={initialData} from="profile" />;
}
