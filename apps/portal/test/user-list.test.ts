import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(import.meta.dir, '../src/views/manage/ManageUsers.tsx'),
  'utf8'
);

describe('admin user list loading characterization', () => {
  test('the client requests and stores the complete user collection', () => {
    expect(source).toContain('fetch(adminUsersApiUrl()');
    expect(source).toContain('useState<UserData[] | null>(null)');
    expect(source).toContain('setUsers(Array.isArray(data)');
    expect(source).not.toMatch(/[?&](?:limit|cursor)=/);
  });
});
