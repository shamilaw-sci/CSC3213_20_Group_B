import { describe, expect, test } from 'bun:test';

const pageSource = await Bun.file(
  new URL('../src/app/admin/users/page.tsx', import.meta.url)
).text();
const componentSource = await Bun.file(
  new URL(
    '../src/components/custom/manage-users-page/ManageUsersPage.tsx',
    import.meta.url
  )
).text();

describe('admin user list loading', () => {
  test('requests one bounded page from the server component', () => {
    expect(pageSource).toContain('adminUsersPageApiUrl(cursor)');
    expect(pageSource).toContain('serverApiJson<AdminUserPageResponse>');
    expect(pageSource).toContain('searchParams: Promise<PageSearchParams>');
  });

  test('keeps current-page filtering in the interactive client island', () => {
    expect(componentSource).not.toContain('fetch(');
    expect(componentSource).not.toContain('useEffect');
    expect(componentSource).toContain('Pagination');
    expect(componentSource).toContain('users.filter');
  });
});
