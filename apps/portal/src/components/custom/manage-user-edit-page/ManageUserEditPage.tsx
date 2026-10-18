'use client';

import { Badge } from '@scs/ui/badge';
import { Save, Shield, UserX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { BackButton } from '@/components/custom/back-button/back-button';
import { PageShell } from '@/components/custom/page-shell/page-shell';
import ProfilePictureEditor, {
  createInitialProfilePictureDraft,
  profilePictureDraftPayload,
  validateProfilePictureDraft,
} from '@/components/custom/profile-picture-editor/ProfilePictureEditor';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { adminUserApiUrl, apiHeaders, readApiError } from '@/lib/api';
import { emailPathSegment } from '@/lib/utils';
import type { AppRole } from '@/types/role';
import {
  ACCESS_LEVEL,
  ACCESS_LEVEL_LABEL,
  ACCESS_LEVELS,
  type AccessLevel,
  APP_ROLES,
  getUserAccessLevel,
  getUserRole,
  ROLE_LABEL,
} from '@/types/role';
import type { AdminUserData } from '@/types/user';

interface ManageUserEditPageProps {
  user: AdminUserData;
}

async function updateUser(
  email: string,
  payload: {
    name: string;
    role: AppRole;
    accessLevel: AccessLevel;
    blacklisted: boolean;
    pictureMode: AdminUserData['pictureMode'];
    picture: string;
    gravatarMail?: string;
  }
) {
  const res = await fetch(adminUserApiUrl(email), {
    method: 'PATCH',
    credentials: 'include',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return res;
}

export default function ManageUserEditPage({ user }: ManageUserEditPageProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<AppRole>(getUserRole(user));
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(
    getUserAccessLevel(user)
  );
  const [blacklisted, setBlacklisted] = useState(user.blacklisted);
  const [profilePicture, setProfilePicture] = useState(() =>
    createInitialProfilePictureDraft({
      picture: user.picture,
      pictureMode: user.pictureMode,
      gravatarMail: user.gravatarMail,
      googleOAuth: user.googleOAuth,
    })
  );
  const [saving, setSaving] = useState(false);
  const previewName = name.trim() || user.email;
  const detailHref = `/admin/users/${emailPathSegment(user.email)}`;

  async function handleSave() {
    if (saving) return;
    const trimmedName = name.trim();
    const pictureError = validateProfilePictureDraft(profilePicture);
    if (pictureError) {
      toast.error(pictureError);
      return;
    }

    setSaving(true);
    try {
      const res = await updateUser(user.email, {
        name: trimmedName,
        role,
        accessLevel,
        blacklisted,
        ...profilePictureDraftPayload(profilePicture),
      });
      if (res.status === 401) {
        router.push('/logout');
        return;
      }
      if (!res.ok) {
        const body = await readApiError(res);
        toast.error(body.message ?? 'Failed to update user');
        return;
      }
      toast.success('User updated successfully');
      router.replace(detailHref);
      router.refresh();
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error('Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      {/* Breadcrumb / Back navigation */}
      <div className="flex items-center gap-2">
        <BackButton
          fallbackHref={detailHref}
          label="Back to User"
          preferFallback
        />
      </div>

      {/* User identity header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.picture} alt={previewName} />
              <AvatarFallback className="text-xl">
                {previewName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-semibold">{previewName}</h1>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle>Edit User</CardTitle>
          <CardDescription>
            Manage person role, access level, and account status for this user.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="display-name" className="text-base">
              Display Name
            </Label>
            <Input
              id="display-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter display name"
              disabled={saving}
              maxLength={120}
            />
            <p className="text-muted-foreground text-sm">
              This name is shown in profile and admin user lists.
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-base">Profile Picture</Label>
              <p className="text-muted-foreground text-sm">
                Choose how this user&apos;s saved picture URL should be updated.
              </p>
            </div>
            <ProfilePictureEditor
              email={user.email}
              name={previewName}
              draft={profilePicture}
              onChange={setProfilePicture}
              googleOAuth={user.googleOAuth}
              githubOAuth={user.githubOAuth}
              githubUserID={user.githubUserID}
              disabled={saving}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-base">Role</Label>
              <p className="text-muted-foreground text-sm">
                Choose the user&apos;s person role.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {APP_ROLES.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={role === option ? 'default' : 'outline'}
                  onClick={() => setRole(option)}
                  disabled={saving}
                  className="justify-center"
                >
                  {ROLE_LABEL[option]}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-base">Access Level</Label>
              <p className="text-muted-foreground text-sm">
                Choose the inherited management permission.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {ACCESS_LEVELS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={accessLevel === option ? 'default' : 'outline'}
                  onClick={() => setAccessLevel(option)}
                  disabled={saving}
                  className="justify-center"
                >
                  {option === ACCESS_LEVEL.SUPER_ADMIN && (
                    <Shield className="size-4" />
                  )}
                  {ACCESS_LEVEL_LABEL[option]}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base">Blacklisted</Label>
              <p className="text-muted-foreground text-sm">
                Prevent this user from accessing the platform
              </p>
            </div>
            <div className="flex items-center gap-2">
              {blacklisted && (
                <Badge
                  variant="outline"
                  className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                >
                  <UserX className="mr-0.5 size-3" />
                  Blacklisted
                </Badge>
              )}
              <Switch
                checked={blacklisted}
                onCheckedChange={setBlacklisted}
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end gap-3">
        <BackButton
          fallbackHref={detailHref}
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
