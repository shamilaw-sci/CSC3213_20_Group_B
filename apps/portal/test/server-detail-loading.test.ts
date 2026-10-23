import { describe, expect, test } from 'bun:test';

const adminUserPageSource = await Bun.file(
  new URL('../src/app/admin/users/[email]/page.tsx', import.meta.url)
).text();
const profileRouteSource = await Bun.file(
  new URL('../src/app/user/me/public-profile/page.tsx', import.meta.url)
).text();
const profileEditorSource = await Bun.file(
  new URL(
    '../src/components/profiles/public-profile-editor.tsx',
    import.meta.url
  )
).text();

describe('server-rendered detail loading', () => {
  test('loads one selected admin user in its server route', () => {
    expect(adminUserPageSource).toContain(
      'await loadAdminUser(decodeURIComponent(email))'
    );
    expect(adminUserPageSource).not.toContain('useEffect');
    expect(adminUserPageSource).not.toContain('fetch(');
  });

  test('passes public-profile data from the server into the editor', () => {
    expect(profileRouteSource).toContain('await loadPublicProfileEditorData()');
    expect(profileRouteSource).toContain('initialData={initialData}');
    expect(profileEditorSource).toContain('initialData.schema');
    expect(profileEditorSource).not.toContain(
      'void Promise.resolve().then(refresh)'
    );
  });
});
