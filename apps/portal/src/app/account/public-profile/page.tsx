import PublicProfilePage from '@/components/custom/public-profile-page/PublicProfilePage';
import { loadPublicProfileEditorData } from '@/lib/server/public-profile';

export default async function Page() {
  const initialData = await loadPublicProfileEditorData();

  return <PublicProfilePage initialData={initialData} from="dashboard" />;
}
