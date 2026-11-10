import { createCloudflareAvatarImageProcessor } from '@/services/avatar-image-processor';
import type { AvatarImageProcessor } from '@/services/avatar-image-processor';
import type { Env } from '@/types/env';

const processors = new WeakMap<Env, AvatarImageProcessor>();

export function avatarImageProcessor(env: Env): AvatarImageProcessor {
  if (env.AVATAR_IMAGE_PROCESSOR) return env.AVATAR_IMAGE_PROCESSOR;
  const cached = processors.get(env);
  if (cached) return cached;
  const processor = createCloudflareAvatarImageProcessor(env.IMAGES);
  processors.set(env, processor);
  return processor;
}
