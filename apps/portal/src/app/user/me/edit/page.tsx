import ProfileEditPage from '@/app/user/me/edit/_components/profile-edit-page';
import { loadCurrentUserProfile } from '@/lib/server/user';

export default async function Page() {
  const user = await loadCurrentUserProfile();

  return (
    <ProfileEditPage
      email={user.email}
      name={user.name ?? ''}
      picture={user.picture ?? ''}
      pictureMode={user.pictureMode}
      gravatarMail={user.gravatarMail}
      googleOAuth={user.googleOAuth}
      githubOAuth={user.githubOAuth}
      githubUserID={user.githubUserID}
    />
  );
}
