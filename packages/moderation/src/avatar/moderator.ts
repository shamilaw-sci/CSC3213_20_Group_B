import { avatarDecision, unavailableModeration } from '#avatar/policy';
import type { AvatarModerator, AvatarProvider } from '#avatar/types';

export function createAvatarModerator(options: {
  provider: AvatarProvider;
}): AvatarModerator {
  return {
    async moderate(image) {
      try {
        const result = await options.provider.classify(image);
        return result.kind === 'classification'
          ? avatarDecision(result.classification)
          : unavailableModeration(result.kind);
      } catch {
        return unavailableModeration('unavailable');
      }
    },
  };
}
