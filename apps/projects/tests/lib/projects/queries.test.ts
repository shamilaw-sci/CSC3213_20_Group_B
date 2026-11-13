import type { Project } from '@scs/schemas';

import { getAllProjectData } from '@/lib/projects/projects-data';
import { getAllProjects } from '@/lib/projects/queries';

vi.mock('@/lib/projects/projects-data', () => ({
  getAllProjectData: vi.fn(),
}));

const getAllProjectDataMock = vi.mocked(getAllProjectData);

describe('project registry queries', () => {
  test('sorts projects by newest update without changing their records', async () => {
    const older = { dates: { lastUpdatedAt: '2026-10-01' } } as Project;
    const newer = { dates: { lastUpdatedAt: '2026-11-01' } } as Project;
    getAllProjectDataMock.mockResolvedValue([older, newer]);

    expect(await getAllProjects()).toEqual([newer, older]);
    expect(older.dates.lastUpdatedAt).toBe('2026-10-01');
  });
});
