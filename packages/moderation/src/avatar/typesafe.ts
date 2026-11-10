import { z } from 'zod';

import type { AvatarProvider, AvatarProviderResult } from '#avatar/types';

const probability = z.number().finite().min(0).max(1);
const safetyValues = [
  'safe',
  'sexual',
  'violence',
  'hate',
  'gesture',
  'uncertain',
] as const;
const portraitValues = [
  'portrait',
  'blurry',
  'obscured',
  'non_portrait',
  'meme_logo',
  'multiple',
  'uncertain',
] as const;

function choiceSchema<const T extends readonly [string, ...string[]]>(
  values: T
) {
  return z.object({
    type: z.literal('choice'),
    choice: z.enum(values),
    confidence: probability,
    probabilities: z.record(z.string(), z.unknown()),
  });
}

const responseSchema = z.object({
  answers: z.object({
    safety: choiceSchema(safetyValues),
    suitability: choiceSchema(portraitValues),
  }),
});

// Keep the established questions and criteria together for provider audits.
const request = {
  model: 'jev-latest',
  state: { photo: '<avatar-photo>' },
  assets: { '<avatar-photo>': { type: 'image', part: 'photo' } },
  questions: {
    safety: {
      type: 'choice',
      instructions:
        'Classify the visible safety content in `photo`. Judge only visible content.',
      criteria: {
        safe: 'No explicit sexual, graphic violent, hateful or extremist, or clearly inappropriate gesture content',
        sexual: 'Sexual nudity or explicit sexual content',
        violence: 'Graphic violence or gore',
        hate: 'Hateful or extremist symbol or content',
        gesture: 'Clearly inappropriate gesture',
        uncertain: 'Cannot reliably determine safety',
      },
    },
    suitability: {
      type: 'choice',
      instructions:
        'Classify `photo` as a public single-person profile portrait. Do not penalize clothing, ethnicity, religion, disability, hairstyle, age, or cultural appearance.',
      criteria: {
        portrait:
          'One recognizable person with a reasonably visible face, including casual clothing',
        blurry: 'Portrait too blurry or low resolution',
        obscured: 'Face obscured or not clearly visible',
        non_portrait: 'No person or irrelevant scene',
        meme_logo: 'Screenshot, meme, illustration, or logo',
        multiple: 'Multiple people',
        uncertain: 'Cannot reliably determine portrait suitability',
      },
    },
  },
};

export function createTypeSafeProvider(options: {
  apiKey: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
}): AvatarProvider {
  return {
    async classify(image): Promise<AvatarProviderResult> {
      if (!options.apiKey) return { kind: 'unavailable' };
      const form = new FormData();
      form.append(
        'request',
        new Blob([JSON.stringify(request)], { type: 'application/json' }),
        'request'
      );
      form.append(
        'photo',
        new Blob([image.slice().buffer], { type: 'image/jpeg' }),
        'avatar.jpg'
      );
      try {
        const response = await (options.fetch ?? fetch)(
          'https://api.typesafe.ai/v1/systemone',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${options.apiKey}`,
              'TypeSafe-Danger-Zone-Images': 'true',
            },
            body: form,
            signal: AbortSignal.timeout(15_000),
          }
        );
        if (!response.ok) return { kind: 'unavailable' };
        const parsed = responseSchema.safeParse(await response.json());
        if (!parsed.success) return { kind: 'invalid_response' };
        const { safety, suitability } = parsed.data.answers;
        const safetyProbability = probability.safeParse(
          safety.probabilities[safety.choice]
        );
        const portraitProbability = probability.safeParse(
          suitability.probabilities[suitability.choice]
        );
        if (!safetyProbability.success || !portraitProbability.success)
          return { kind: 'invalid_response' };
        return {
          kind: 'classification',
          classification: {
            safety: {
              value:
                safety.choice === 'safe' || safety.choice === 'uncertain'
                  ? safety.choice
                  : 'unsafe',
              confidence: safety.confidence,
              probability: safetyProbability.data,
            },
            portrait: {
              value:
                suitability.choice === 'portrait' ||
                suitability.choice === 'uncertain'
                  ? suitability.choice
                  : 'unsuitable',
              confidence: suitability.confidence,
              probability: portraitProbability.data,
            },
          },
        };
      } catch {
        return { kind: 'unavailable' };
      }
    },
  };
}
