import type { Project } from '@scs/schemas';
import { render, screen } from '@testing-library/react';

import { SiteFooter } from '@/components/layout/site-footer';
import { fetchProjects } from '@/lib/projects/api-client';

vi.mock('@/lib/projects/api-client', () => ({
  fetchProjects: vi.fn(),
}));

const fetchProjectsMock = vi.mocked(fetchProjects);

function project(id: number, projectType: Project['projectType']): Project {
  return {
    id: `project-${id}`,
    slug: `project-${id}`,
    title: `Project ${id}`,
    shortDescription: `Description ${id}`,
    description: `Detailed description ${id}`,
    projectType,
    status: 'ACTIVE',
    categories: ['Research'],
    tags: [],
    departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
    people: [{ name: 'Student', role: 'student' }],
    links: {},
    source: { kind: 'MANUAL', curator: 'SCS' },
    media: { icon: 'FolderKanban' },
    dates: { lastUpdatedAt: '2026-10-25' },
  };
}

describe('Projects SiteFooter', () => {
  test('links to Browse, populated types, and department-owned course indexes', async () => {
    fetchProjectsMock.mockResolvedValue([
      project(1, 'RESEARCH_PROJECT'),
      project(2, 'OTHER'),
    ]);
    const { container } = render(<SiteFooter />);

    expect(
      await screen.findByRole('link', { name: 'Research Projects' })
    ).toHaveAttribute('href', '/types/research-projects');
    expect(screen.getByRole('link', { name: 'Other' })).toHaveAttribute(
      'href',
      '/types/other'
    );
    expect(screen.queryByRole('link', { name: 'Datasets' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Browse projects' })
    ).toHaveAttribute('href', '/browse');
    expect(
      screen.getByRole('link', { name: 'Undergraduate courses' })
    ).toHaveAttribute('href', 'https://scs.pdn.ac.lk/undergraduate-courses');
    expect(
      screen.getByRole('link', { name: 'Postgraduate courses' })
    ).toHaveAttribute('href', 'https://scs.pdn.ac.lk/postgraduate-courses');

    for (const link of container.querySelectorAll('a')) {
      expect(link.getAttribute('href')).not.toContain('?');
    }
  });
});
