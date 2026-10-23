'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@scs/ui/components/avatar';
import { Button } from '@scs/ui/components/button';
import { Input } from '@scs/ui/components/input';
import { Label } from '@scs/ui/components/label';
import { cn } from 'cn';
import {
  CheckCircle2,
  Circle,
  Code2,
  Image as ImageIcon,
  RefreshCw,
  UserCircle,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import type { ProfilePictureMode } from '@/types/user';

export interface ProfilePictureDraft {
  pictureMode: ProfilePictureMode;
  picture: string;
  gravatarMail: string;
}

interface ProfilePictureEditorProps {
  email: string;
  name: string;
  draft: ProfilePictureDraft;
  onChange: (draft: ProfilePictureDraft) => void;
  googleOAuth?: boolean;
  githubOAuth?: boolean;
  githubUserID?: number | null;
  disabled?: boolean;
}

interface SourceOptionProps {
  active: boolean;
  disabled?: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

type PreviewStatus = 'loaded' | 'error';

export function createInitialProfilePictureDraft(input: {
  picture: string;
  pictureMode?: ProfilePictureMode | null;
  gravatarMail?: string | null;
  googleOAuth?: boolean;
}): ProfilePictureDraft {
  return {
    pictureMode: input.pictureMode ?? (input.googleOAuth ? 'google' : 'manual'),
    picture: input.picture,
    gravatarMail: input.gravatarMail ?? '',
  };
}

export function validateProfilePictureDraft(
  draft: ProfilePictureDraft
): string | null {
  if (draft.pictureMode !== 'manual') return null;

  const trimmed = draft.picture.trim();
  if (!trimmed) return 'Profile picture URL is required';

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return 'Profile picture URL must be valid';
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'Profile picture URL must use HTTP or HTTPS';
  }

  return null;
}

export function profilePictureDraftPayload(draft: ProfilePictureDraft) {
  return {
    pictureMode: draft.pictureMode,
    picture: draft.picture.trim(),
    gravatarMail: draft.gravatarMail.trim() || undefined,
  };
}

function githubAvatarUrl(githubUserID?: number | null) {
  return githubUserID
    ? `https://avatars.githubusercontent.com/u/${githubUserID}?v=4`
    : '';
}

function SourceOption({
  active,
  disabled,
  icon,
  title,
  description,
  onClick,
}: SourceOptionProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-auto justify-start gap-3 p-4 text-left whitespace-normal',
        active && 'border-primary bg-primary/5'
      )}
    >
      <span className="text-primary mt-0.5">
        {active ? <CheckCircle2 /> : icon}
      </span>
      <span className="min-w-0 space-y-1">
        <span className="block font-medium">{title}</span>
        <span className="text-muted-foreground block text-sm leading-5">
          {description}
        </span>
      </span>
    </Button>
  );
}

export default function ProfilePictureEditor({
  email,
  name,
  draft,
  onChange,
  googleOAuth = false,
  githubOAuth = false,
  githubUserID = null,
  disabled = false,
}: ProfilePictureEditorProps) {
  const [customPreview, setCustomPreview] = useState<{
    src: string;
    status: PreviewStatus;
  } | null>(null);
  const previewPicture =
    draft.pictureMode === 'github'
      ? githubAvatarUrl(githubUserID) || draft.picture
      : draft.picture;
  const fallbackName = name.trim() || email;
  const customUrlError = validateProfilePictureDraft(draft);
  const customPictureUrl = draft.picture.trim();
  const customPreviewStatus =
    draft.pictureMode === 'manual' &&
    !customUrlError &&
    customPictureUrl &&
    customPreview?.src === customPictureUrl
      ? customPreview.status
      : 'loading';

  function setDraft(patch: Partial<ProfilePictureDraft>) {
    onChange({ ...draft, ...patch });
  }

  function setMode(pictureMode: ProfilePictureMode) {
    setDraft({
      pictureMode,
      ...(pictureMode === 'github'
        ? { picture: githubAvatarUrl(githubUserID) || draft.picture }
        : {}),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={previewPicture} alt={fallbackName} />
          <AvatarFallback className="text-xl">
            {fallbackName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-base font-medium">{fallbackName}</p>
          <p className="text-muted-foreground truncate text-sm">
            Profile picture source: {draft.pictureMode}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base">Profile Picture Source</Label>
        <div className="grid gap-2">
          <SourceOption
            active={draft.pictureMode === 'google'}
            disabled={disabled || !googleOAuth}
            icon={<RefreshCw className="size-4" />}
            title="Google"
            description="Update from Google each time this user signs in."
            onClick={() => setMode('google')}
          />
          <SourceOption
            active={draft.pictureMode === 'github'}
            disabled={disabled || !githubOAuth || !githubUserID}
            icon={<Code2 className="size-4" />}
            title="GitHub"
            description="Use the linked GitHub avatar URL."
            onClick={() => setMode('github')}
          />
          <SourceOption
            active={draft.pictureMode === 'gravatar'}
            disabled={disabled}
            icon={<UserCircle className="size-4" />}
            title="Gravatar"
            description="Use a Gravatar image from the university email or another email."
            onClick={() => setMode('gravatar')}
          />
          <SourceOption
            active={draft.pictureMode === 'manual'}
            disabled={disabled}
            icon={<ImageIcon className="size-4" />}
            title="Custom URL"
            description="Use a direct image URL. The server verifies PNG, JPG, JPEG, or WebP on save."
            onClick={() => setMode('manual')}
          />
        </div>
      </div>

      {draft.pictureMode === 'gravatar' && (
        <div className="space-y-3">
          <Label className="text-base">Gravatar Email</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={!draft.gravatarMail ? 'default' : 'outline'}
              onClick={() => setDraft({ gravatarMail: '' })}
              disabled={disabled}
              className="justify-start"
            >
              {!draft.gravatarMail ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <Circle className="size-4" />
              )}
              University email
            </Button>
            <Button
              type="button"
              variant={draft.gravatarMail ? 'default' : 'outline'}
              onClick={() => setDraft({ gravatarMail: email })}
              disabled={disabled}
              className="justify-start"
            >
              {draft.gravatarMail ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <Circle className="size-4" />
              )}
              Another email
            </Button>
          </div>
          {draft.gravatarMail && (
            <div className="space-y-2">
              <Label htmlFor="gravatar-email" className="text-base">
                Email
              </Label>
              <Input
                id="gravatar-email"
                value={draft.gravatarMail}
                onChange={(event) =>
                  setDraft({ gravatarMail: event.target.value })
                }
                placeholder={email}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}

      {draft.pictureMode === 'manual' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="profile-picture-url" className="text-base">
              Image URL
            </Label>
            <Input
              id="profile-picture-url"
              value={draft.picture}
              onChange={(event) => setDraft({ picture: event.target.value })}
              placeholder="https://example.com/avatar"
              disabled={disabled}
            />
          </div>
          {customPictureUrl && !customUrlError && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={customPictureUrl}
              src={customPictureUrl}
              alt=""
              className="hidden"
              onLoad={() =>
                setCustomPreview({
                  src: customPictureUrl,
                  status: 'loaded',
                })
              }
              onError={() =>
                setCustomPreview({
                  src: customPictureUrl,
                  status: 'error',
                })
              }
            />
          )}
          {customUrlError ? (
            <p className="text-destructive text-sm">{customUrlError}</p>
          ) : customPreviewStatus === 'loaded' ? (
            <p
              className="flex items-center gap-2 text-sm text-green-600
                dark:text-green-400"
            >
              <CheckCircle2 className="size-4" />
              Image preview loaded. The server will verify the file type on
              save.
            </p>
          ) : customPreviewStatus === 'error' ? (
            <p className="text-destructive flex items-center gap-2 text-sm">
              <XCircle className="size-4" />
              Could not load this image preview.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">Checking preview...</p>
          )}
        </div>
      )}
    </div>
  );
}
