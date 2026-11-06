import { describe, expect, test } from 'bun:test';

import type { PublicAvatarModeration } from '@scs/schemas';

import {
  formatFileSize,
  formatResetTime,
  isSamePublicAvatarSelection,
  moderationCheckLabel,
  moderationRecommendations,
  quotaUsedPercent,
  validatePublicAvatarFile,
} from '@/lib/public-avatar';

function file(type: string, size = 1000, name = 'picture', lastModified = 1) {
  return new File([new Uint8Array(size)], name, { type, lastModified });
}

function moderation(
  status: PublicAvatarModeration['status'],
  checks: PublicAvatarModeration['checks']
): PublicAvatarModeration {
  return {
    status,
    code:
      status === 'rejected'
        ? 'unsafe_content'
        : status === 'approved'
          ? 'approved'
          : status === 'review_required'
            ? 'review_required'
            : 'moderation_unavailable',
    message: 'Result',
    checks,
  };
}

describe('public avatar client helpers', () => {
  test('accepts only JPEG, PNG, and WebP files up to 4 MiB', () => {
    expect(validatePublicAvatarFile(file('image/jpeg'))).toBeNull();
    expect(validatePublicAvatarFile(file('image/png'))).toBeNull();
    expect(validatePublicAvatarFile(file('image/webp'))).toBeNull();
    expect(validatePublicAvatarFile(file('image/gif'))).toBe(
      'Choose a JPEG, PNG, or WebP image.'
    );
    expect(validatePublicAvatarFile(file('image/png', 0))).toBe(
      'This image file is empty.'
    );
    expect(
      validatePublicAvatarFile(file('image/png', 4 * 1024 * 1024 + 1))
    ).toBe('Choose an image smaller than 4 MiB.');
  });

  test('detects a repeated selection of the same file', () => {
    const selected = file('image/png');
    expect(isSamePublicAvatarSelection(selected, file('image/png'))).toBe(true);
    expect(
      isSamePublicAvatarSelection(selected, file('image/png', 1000, 'other'))
    ).toBe(false);
    expect(isSamePublicAvatarSelection(selected, file('image/png', 999))).toBe(
      false
    );
  });

  test('formats file sizes for the pending selection summary', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1536)).toBe('1.5 KiB');
    expect(formatFileSize(4 * 1024 * 1024)).toBe('4 MiB');
  });

  test('formats quota reset times without inventing a timezone', () => {
    const now = Date.UTC(2026, 10, 6, 12, 0, 0);
    const reset = formatResetTime(new Date(now + 65_000).toISOString(), now);
    expect(reset?.relative).toBe('in 2 min');
    expect(reset?.time).toBeTruthy();
    expect(formatResetTime(new Date(now - 1).toISOString(), now)).toEqual({
      relative: 'now',
      time: expect.any(String),
    });
    expect(formatResetTime('not-a-date', now)).toBeNull();
  });

  test('converts server quota values into a bounded display percentage', () => {
    expect(
      quotaUsedPercent({
        limit: 6,
        used: 2,
        remaining: 4,
        windowStartedAt: '2026-11-06T12:00:00.000Z',
        resetsAt: '2026-11-06T13:00:00.000Z',
        retryAfterSeconds: 1800,
        available: true,
      })
    ).toBeCloseTo(33.33, 1);
    expect(
      quotaUsedPercent({
        limit: 6,
        used: 9,
        remaining: 0,
        windowStartedAt: '2026-11-06T12:00:00.000Z',
        resetsAt: '2026-11-06T13:00:00.000Z',
        retryAfterSeconds: 1800,
        available: false,
      })
    ).toBe(100);
  });

  test('labels the real moderation checks and gives targeted guidance', () => {
    expect(moderationCheckLabel({ id: 'safety', status: 'passed' })).toBe(
      'Safety check'
    );
    expect(moderationCheckLabel({ id: 'portrait', status: 'failed' })).toBe(
      'Portrait suitability'
    );

    const rejected = moderation('rejected', [
      { id: 'safety', status: 'failed' },
      { id: 'portrait', status: 'passed' },
    ]);
    expect(moderationRecommendations(rejected).join(' ')).toContain(
      'without nudity'
    );

    const unsuitable = moderation('rejected', [
      { id: 'safety', status: 'passed' },
      { id: 'portrait', status: 'failed' },
    ]);
    expect(moderationRecommendations(unsuitable).join(' ')).toContain(
      'clear, well-lit photo'
    );
  });
});
