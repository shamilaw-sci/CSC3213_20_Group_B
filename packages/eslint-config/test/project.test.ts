import { expect, test } from 'bun:test';

import { projectDirectory } from '@scs/eslint-config/project';

test('resolves file URLs to platform-style project roots', () => {
  expect(projectDirectory('file:///C:/My%20Project/eslint.config.ts')).toBe(
    'C:/My Project'
  );
  expect(projectDirectory('file:///work/project/eslint.config.ts')).toBe(
    '/work/project'
  );
});
