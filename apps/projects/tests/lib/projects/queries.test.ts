import {
  getAllProjects,
  getProjectBySlug,
  getProjectsByCategory,
  getProjectsByTag,
  getProjectStats,
  searchProjects,
} from '@/lib/projects/queries';

describe('project registry queries', () => {
  test('contains multiple project types, not only course projects', async () => {
    const projectTypes = new Set(
      (await getAllProjects()).map((project) => project.projectType)
    );

    expect(projectTypes.has('DEPARTMENT_SYSTEM')).toBe(true);
    expect(projectTypes.has('OTHER')).toBe(true);
    expect(projectTypes.size).toBeGreaterThan(1);
  });

  test('finds canonical project pages by slug', async () => {
    const project = await getProjectBySlug('scs-pdn-portal');

    expect(project?.title).toBe('SCS PDN Portal');
  });

  test('keeps category and tag as filters', async () => {
    expect(
      (await getProjectsByCategory('department-system')).length
    ).toBeGreaterThan(0);
    expect((await getProjectsByTag('authentication')).length).toBeGreaterThan(
      0
    );
  });

  test('returns registry stats for the home dashboard', async () => {
    const [stats, projects] = await Promise.all([
      getProjectStats(),
      getAllProjects(),
    ]);

    expect(stats.total).toBe(projects.length);
    expect(stats.active).toBeGreaterThan(0);
    expect(stats.openSource).toBe(0);
  });

  test('searches across project details', async () => {
    expect((await searchProjects('CSC3213'))[0]?.slug).toBe(
      'csc3213-20-group-a'
    );
    expect(
      (await searchProjects('authentication')).some(
        (project) => project.slug === 'scs-pdn-portal'
      )
    ).toBe(true);
    expect((await searchProjects('people directory'))[0]?.slug).toBe(
      'scs-people-directory'
    );
  });
});
