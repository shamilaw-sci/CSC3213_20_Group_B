import { describe, expect, test } from 'bun:test';

const projectSource = await Bun.file(
  new URL(
    '../src/components/custom/project-management-page/ProjectManagementPage.tsx',
    import.meta.url
  )
).text();
const courseSource = await Bun.file(
  new URL(
    '../src/components/custom/course-management-page/CourseManagementPage.tsx',
    import.meta.url
  )
).text();
const operationSource = await Bun.file(
  new URL('../src/lib/mutation-operation.ts', import.meta.url)
).text();

describe('registry operation clients', () => {
  test('submits project mutations through the asynchronous operation contract', () => {
    expect(projectSource).toContain("Prefer: 'respond-async'");
    expect(projectSource).toContain('waitForMutationOperation');
    expect(projectSource).toContain('expectedRevision:');
  });

  test('submits course and offering mutations through the same contract', () => {
    expect(courseSource).toContain("Prefer: 'respond-async'");
    expect(courseSource).toContain('waitForMutationOperation');
    expect(courseSource).toContain('expectedRevision:');
  });

  test('keeps bounded operation polling in one shared client utility', () => {
    expect(operationSource).toContain('options.maxAttempts ?? 40');
    expect(operationSource).toContain('accepted.retryAfterMs');
    expect(operationSource).toContain('options.signal?.throwIfAborted()');
    expect(operationSource).toContain('assertMutationSucceeded');
  });
});
