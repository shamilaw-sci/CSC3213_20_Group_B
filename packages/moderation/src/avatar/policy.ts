import type { PublicAvatarModeration } from '@scs/schemas';

import type { AvatarClassification } from '#avatar/types';

const NOT_CHECKED: PublicAvatarModeration['checks'] = [
  { id: 'safety', status: 'not_checked' },
  { id: 'portrait', status: 'not_checked' },
];

export function unavailableModeration(
  reason: 'invalid_response' | 'unavailable'
): PublicAvatarModeration {
  return {
    status: 'unavailable',
    code:
      reason === 'invalid_response'
        ? 'moderation_invalid_response'
        : 'moderation_unavailable',
    message:
      reason === 'invalid_response'
        ? 'Moderation response unavailable'
        : 'Moderation service unavailable',
    checks: NOT_CHECKED,
  };
}

function checkOutcome(
  answer: { value: string; confidence: number; probability: number },
  positive: string
): 'passed' | 'failed' | 'needs_review' {
  if (
    answer.value !== positive &&
    answer.value !== 'uncertain' &&
    answer.probability >= 0.85 &&
    answer.confidence >= 0.5
  )
    return 'failed';
  if (
    answer.value === positive &&
    answer.probability >= 0.9 &&
    answer.confidence >= 0.65
  )
    return 'passed';
  return 'needs_review';
}

export function avatarDecision(
  classification: AvatarClassification
): PublicAvatarModeration {
  const checks: PublicAvatarModeration['checks'] = [
    { id: 'safety', status: checkOutcome(classification.safety, 'safe') },
    {
      id: 'portrait',
      status: checkOutcome(classification.portrait, 'portrait'),
    },
  ];
  if (checks[0].status === 'failed')
    return {
      status: 'rejected',
      code: 'unsafe_content',
      message: 'Image does not meet public avatar safety rules',
      checks,
    };
  if (checks[1].status === 'failed')
    return {
      status: 'rejected',
      code: 'unsuitable_portrait',
      message: 'Image is not a suitable single-person portrait',
      checks,
    };
  if (checks.some((check) => check.status !== 'passed'))
    return {
      status: 'review_required',
      code: 'review_required',
      message: 'Image needs manual review',
      checks,
    };
  return {
    status: 'approved',
    code: 'approved',
    message: 'Picture approved',
    checks,
  };
}
