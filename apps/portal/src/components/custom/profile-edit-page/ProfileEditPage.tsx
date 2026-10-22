'use client';

import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { Input } from '@scs/ui/components/input';
import { Label } from '@scs/ui/components/label';
import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { BackButton } from '@/components/custom/back-button/back-button';
import ProfilePictureEditor, {
  createInitialProfilePictureDraft,
  profilePictureDraftPayload,
  validateProfilePictureDraft,
} from '@/components/custom/profile-picture-editor/ProfilePictureEditor';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { apiHeaders, meApiUrl } from '@/lib/api';
import type { ProfilePictureMode } from '@/types/user';

interface ProfileEditPageProps {
  email: string;
  name: string;
  picture: string;
  pictureMode?: ProfilePictureMode | null;
  gravatarMail?: string | null;
  googleOAuth?: boolean;
  githubOAuth?: boolean;
  githubUserID?: number | null;
}

async function getErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    return body.message ?? body.error ?? response.statusText;
  }

  const text = await response.text().catch(() => '');
  return text.trim() || response.statusText || 'Failed to update profile';
}

export default function ProfileEditPage({
  email,
  name,
  picture,
  pictureMode,
  gravatarMail,
  googleOAuth = false,
  githubOAuth = false,
  githubUserID = null,
}: ProfileEditPageProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name);
  const [profilePicture, setProfilePicture] = useState(() =>
    createInitialProfilePictureDraft({
      picture,
      pictureMode,
      gravatarMail,
      googleOAuth,
    })
  );
  const [saving, setSaving] = useState(false);
  const previewName = displayName.trim() || email;

  async function handleSave() {
    if (saving) return;

    const pictureError = validateProfilePictureDraft(profilePicture);
    if (pictureError) {
      toast.error(pictureError);
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(meApiUrl(), {
        method: 'PATCH',
        credentials: 'include',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: displayName.trim(),
          ...profilePictureDraftPayload(profilePicture),
        }),
      });

      if (res.status === 401) {
        router.push('/logout');
        return;
      }

      if (!res.ok) {
        toast.error(await getErrorMessage(res));
        return;
      }

      toast.success('Profile updated');
      router.replace('/user/me');
      router.refresh();
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <BackButton fallbackHref="/user/me" label="Back to Info" preferFallback />
      <PageHeader
        title="Edit Profile"
        description="Update the public identity shown on your profile."
      />

      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>
            Change the name people see across the portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="display-name" className="text-base">
              Display Name
            </Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Enter your display name"
              disabled={saving}
              maxLength={120}
            />
            <p className="text-muted-foreground text-sm">
              This name appears on your profile and in admin views.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>
            Choose how the saved picture URL should be updated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfilePictureEditor
            email={email}
            name={previewName}
            draft={profilePicture}
            onChange={setProfilePicture}
            googleOAuth={googleOAuth}
            githubOAuth={githubOAuth}
            githubUserID={githubUserID}
            disabled={saving}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <BackButton
          fallbackHref="/user/me"
          label="Cancel"
          preferFallback
          variant="outline"
          size="default"
        />
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 size-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </PageShell>
  );
}
