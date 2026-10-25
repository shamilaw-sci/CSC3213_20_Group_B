import type { Project } from '@scs/schemas';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Home from '@/app/_components/home';
import { fetchProjects } from '@/lib/projects/api-client';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/projects/api-client', () => ({
  fetchProjects: vi.fn(),
}));

const fetchProjectsMock = vi.mocked(fetchProjects);

function project(id: number, overrides: Partial<Project> = {}): Project {
  return {
    id: `project-${id}`,
    slug: `project-${id}`,
    title: `Project ${id}`,
    shortDescription: `A clear description for project ${id}.`,
    description: `Detailed description for project ${id}.`,
    projectType: 'RESEARCH_PROJECT',
    status: 'ACTIVE',
    categories: ['Research'],
    tags: ['Accessibility'],
    departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
    people: [{ name: 'Test Student', role: 'student' }],
    links: {},
    source: { kind: 'MANUAL', curator: 'SCS' },
    media: { icon: 'FolderKanban' },
    dates: { lastUpdatedAt: `2026-10-${20 + id}` },
    ...overrides,
  };
}

const projects = [
  project(1, { title: 'Older Research' }),
  project(2, {
    title: 'Department Platform',
    projectType: 'DEPARTMENT_SYSTEM',
    categories: ['Department Services'],
    tags: ['Open Data'],
  }),
  project(3, {
    title: 'Honest Other Project',
    projectType: 'OTHER',
    categories: ['Coursework'],
    tags: [],
  }),
];

describe('Projects showcase home', () => {
  beforeEach(() => {
    push.mockReset();
    fetchProjectsMock.mockReset();
    fetchProjectsMock.mockResolvedValue(projects);
  });

  test('presents populated schema collections before recent and secondary discovery', async () => {
    const { container } = render(<Home />);

    expect(
      await screen.findByRole('heading', { name: 'Projects from SCS' })
    ).toBeInTheDocument();

    const typeHeading = screen.getByRole('heading', {
      name: 'Explore by project type',
    });
    const recentHeading = screen.getByRole('heading', {
      name: 'Recently updated',
    });
    const categoryHeading = screen.getByRole('heading', {
      name: 'Browse by category',
    });
    expect(
      typeHeading.compareDocumentPosition(recentHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      recentHeading.compareDocumentPosition(categoryHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    expect(
      screen.getByRole('link', { name: /Research Projects.*1 project/iu })
    ).toHaveAttribute('href', '/types/research-projects');
    expect(
      screen.getByRole('link', { name: /Department Systems.*1 project/iu })
    ).toHaveAttribute('href', '/types/department-systems');
    expect(
      screen.getByRole('link', { name: /Other.*1 project/iu })
    ).toHaveAttribute('href', '/types/other');
    expect(screen.queryByRole('link', { name: /Datasets/iu })).toBeNull();

    const recentSection = recentHeading.closest('section');
    expect(recentSection).not.toBeNull();
    expect(
      within(recentSection as HTMLElement)
        .getAllByRole('link')
        .filter((link) => link.getAttribute('href')?.startsWith('/projects/'))
        .map((link) => link.textContent)
    ).toEqual([
      expect.stringContaining('Honest Other Project'),
      expect.stringContaining('Department Platform'),
      expect.stringContaining('Older Research'),
    ]);

    expect(
      screen.getByRole('link', { name: /Coursework.*1/iu })
    ).toHaveAttribute('href', '/categories/coursework');
    expect(
      screen.getByRole('link', { name: /Accessibility.*1/iu })
    ).toHaveAttribute('href', '/topics/accessibility');
    expect(
      screen.getByRole('link', { name: 'Browse all projects' })
    ).toHaveAttribute('href', '/browse');
    expect(container.querySelector('main')).toBeNull();
    expect(screen.queryByText('Narrow the Results')).toBeNull();
    expect(screen.queryByLabelText('Status')).toBeNull();

    for (const link of container.querySelectorAll('a')) {
      expect(link.getAttribute('href')).not.toContain('?');
    }
  });

  test('submits the prominent search through the canonical path', async () => {
    const user = userEvent.setup();
    render(<Home />);

    const input = await screen.findByLabelText('Search projects');
    await user.type(input, 'C++ data');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(push).toHaveBeenCalledWith('/search/c%2B%2B-data');
  });

  test('omits empty topic and showcase sections instead of rendering placeholders', async () => {
    fetchProjectsMock.mockResolvedValueOnce([
      project(1, { projectType: 'OTHER', tags: [] }),
    ]);
    render(<Home />);

    expect(await screen.findByText('Project 1')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Explore topics' })
    ).toBeNull();
    expect(screen.queryByText('Dataset')).toBeNull();
  });

  test('retries a failed published-data request', async () => {
    fetchProjectsMock
      .mockRejectedValueOnce(new Error('registry unavailable'))
      .mockResolvedValueOnce([project(1)]);
    const user = userEvent.setup();
    render(<Home />);

    expect(
      await screen.findByText('Projects are unavailable')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(fetchProjectsMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Project 1')).toBeInTheDocument();
  });
});
