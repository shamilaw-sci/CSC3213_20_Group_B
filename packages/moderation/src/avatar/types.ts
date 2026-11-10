import type { PublicAvatarModeration } from '@scs/schemas';

export interface AvatarClassification {
  safety: {
    value: 'safe' | 'unsafe' | 'uncertain';
    confidence: number;
    probability: number;
  };
  portrait: {
    value: 'portrait' | 'unsuitable' | 'uncertain';
    confidence: number;
    probability: number;
  };
}

export type AvatarProviderResult =
  | { kind: 'classification'; classification: AvatarClassification }
  | { kind: 'invalid_response' }
  | { kind: 'unavailable' };

export interface AvatarProvider {
  classify(image: Uint8Array): Promise<AvatarProviderResult>;
}

export interface AvatarModerator {
  moderate(image: Uint8Array): Promise<PublicAvatarModeration>;
}
