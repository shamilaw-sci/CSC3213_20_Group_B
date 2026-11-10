import { describe, expect, it } from 'bun:test';

import {
  ACCESS_LEVEL,
  ACCESS_LEVELS,
  AccessLevelSchema,
  AdminUserDetailResponseSchema,
  AdminUserPageSchema,
  APP_ROLE,
  APP_ROLES,
  AppRoleSchema,
  CurrentUserResponseSchema,
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

  it('accepts omitted identity details and preserves null provider data', () => {
    const response = {
      email: 'student@example.com',
      name: 'Student',
      picture: '',
      role: 'STUDENT' as const,
      accessLevel: 'NONE' as const,
      blacklisted: false,
      googleOAuth: true,
      githubOAuth: false,
      githubUserID: null,
      pictureMode: null,
      gravatarMail: null,
      isEmailNotificationEnabled: true,
      isPushNotificationEnabled: false,
    };
    expect(CurrentUserResponseSchema.parse(response)).toEqual(response);
    expect(
      CurrentUserResponseSchema.parse({
        ...response,
        name: undefined,
        picture: undefined,
      })
    ).toEqual({ ...response, name: undefined, picture: undefined });
    expect(
      CurrentUserResponseSchema.safeParse({
        ...response,
        githubUserID: undefined,
      }).success
    ).toBe(false);
  });

  it('distinguishes list and detail user contracts', () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      picture: '',
      role: 'USER',
      accessLevel: 'NONE',
      blacklisted: false,
    };
    expect(
      AdminUserPageSchema.safeParse({
        version: 1,
        items: [user],
        page: { nextCursor: null, hasMore: false },
      }).success
    ).toBe(true);
    expect(
      AdminUserDetailResponseSchema.safeParse({
        ...user,
        googleOAuth: false,
        githubOAuth: false,
        githubUserID: null,
      }).success
    ).toBe(true);
    const detail = {
      ...user,
      role: APP_ROLE.USER,
      accessLevel: ACCESS_LEVEL.NONE,
      googleOAuth: false,
      githubOAuth: false,
      githubUserID: null,
      include: { 'owner/repo': 'EDITOR' as const },
      exclude: ['owner/other'],
      notifications: { email: true, push: false },
    };
    expect(AdminUserDetailResponseSchema.parse(detail)).toEqual(detail);
    expect(AdminUserDetailResponseSchema.safeParse(user).success).toBe(false);
  });
});
