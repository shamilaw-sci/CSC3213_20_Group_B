import { describe, expect, it } from 'bun:test';

import {
  ACCESS_LEVEL,
  ACCESS_LEVELS,
  AccessLevelSchema,
  APP_ROLE,
  APP_ROLES,
  AppRoleSchema,
  PROFILE_PICTURE_MODES,
  ProfilePictureModeSchema,
} from '#index';

describe('permission schemas', () => {
  it('keeps role constants aligned with the schema options', () => {
    expect([...APP_ROLES]).toEqual([...AppRoleSchema.options]);
    expect(Object.keys(APP_ROLE).sort()).toEqual([...APP_ROLES].sort());
  });

  it('keeps access-level constants aligned with the schema options', () => {
    expect([...ACCESS_LEVELS]).toEqual([...AccessLevelSchema.options]);
    expect(Object.keys(ACCESS_LEVEL).sort()).toEqual([...ACCESS_LEVELS].sort());
  });

  it('validates known and unknown values', () => {
    expect(AppRoleSchema.safeParse('ACADEMIC').success).toBe(true);
    expect(AppRoleSchema.safeParse('TEACHER').success).toBe(false);
    expect(AccessLevelSchema.safeParse('SUPER_ADMIN').success).toBe(true);
    expect(AccessLevelSchema.safeParse('OWNER').success).toBe(false);
    expect(ProfilePictureModeSchema.safeParse('gravatar').success).toBe(true);
    expect([...PROFILE_PICTURE_MODES]).toEqual([
      ...ProfilePictureModeSchema.options,
    ]);
  });
});
