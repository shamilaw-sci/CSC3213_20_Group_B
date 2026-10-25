import { getAllProjects } from '@/lib/projects/queries';

describe('project registry queries', () => {
  test('contains multiple project types, not only course projects', async () => {
    const projectTypes = new Set(
      (await getAllProjects()).map((project) => project.projectType)
    );

    expect(projectTypes.has('DEPARTMENT_SYSTEM')).toBe(true);
    expect(projectTypes.has('OTHER')).toBe(true);
    expect(projectTypes.size).toBeGreaterThan(1);
  });
});
