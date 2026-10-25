import type { Project } from '@scs/schemas';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProjectDirectory } from '@/components/projects/project-directory';
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
    dates: { lastUpdatedAt: '2026-10-25' },
    ...overrides,
  };
}

describe('ProjectDirectory', () => {
  beforeEach(() => {
    push.mockReset();
    fetchProjectsMock.mockReset();
  });

  test('renders a bounded collection with path-only pagination links', async () => {
    fetchProjectsMock.mockResolvedValue(
      Array.from({ length: 13 }, (_, index) => project(index + 1))
    );

    const { container } = render(
      <ProjectDirectory
        collection={{ kind: 'type', projectType: 'RESEARCH_PROJECT' }}
        page={1}
      />
    );

    expect(
      await screen.findByRole('heading', { name: 'Research Projects' })
    ).toBeInTheDocument();
    expect(screen.getByText('13 projects')).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /^Project \d+$/u })
    ).toHaveLength(12);
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/types/research-projects/page/2'
    );

    for (const link of container.querySelectorAll('a')) {
      expect(link.getAttribute('href')).not.toContain('?');
    }
  });

  test('exposes populated collection paths from the complete directory', async () => {
    fetchProjectsMock.mockResolvedValue([project(1)]);
    render(<ProjectDirectory collection={{ kind: 'browse' }} page={1} />);

    expect(
      await screen.findByRole('heading', { name: 'Explore collections' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Research Project' })
    ).toHaveAttribute('href', '/types/research-projects');
    expect(screen.getByRole('link', { name: 'Research' })).toHaveAttribute(
      'href',
      '/categories/research'
    );
    expect(screen.getByRole('link', { name: 'Accessibility' })).toHaveAttribute(
      'href',
      '/topics/accessibility'
    );
  });

  test('submits search terms to a path and sends an empty search to browse', async () => {
    fetchProjectsMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ProjectDirectory collection={{ kind: 'browse' }} page={1} />);

    const input = await screen.findByLabelText('Search projects');
    await user.type(input, 'C++ / data');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(push).toHaveBeenLastCalledWith('/search/c%2B%2B-data');

    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(push).toHaveBeenLastCalledWith('/browse');

    await user.type(input, '---');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(push).toHaveBeenLastCalledWith('/browse');
  });

  test('distinguishes a valid empty type from an unknown derived collection', async () => {
    fetchProjectsMock.mockResolvedValue([project(1)]);

    const valid = render(
      <ProjectDirectory
        collection={{ kind: 'type', projectType: 'DATASET' }}
        page={1}
      />
    );
    expect(
      await screen.findByText('No Dataset projects yet')
    ).toBeInTheDocument();
    valid.unmount();

    render(
      <ProjectDirectory
        collection={{ kind: 'category', value: 'missing-category' }}
        page={1}
      />
    );
    expect(await screen.findByText('Category not found')).toBeInTheDocument();
  });

  test('shows loading and retryable network failure as separate states', async () => {
    let rejectRequest: ((reason: Error) => void) | undefined;
    fetchProjectsMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        })
    );

    const user = userEvent.setup();
    render(<ProjectDirectory collection={{ kind: 'browse' }} page={1} />);
    expect(
      screen.getByRole('status', { name: 'Loading project directory' })
    ).toBeInTheDocument();

    rejectRequest?.(new Error('network unavailable'));
    expect(
      await screen.findByText('Projects are unavailable')
    ).toBeInTheDocument();

    fetchProjectsMock.mockResolvedValueOnce([project(1)]);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(fetchProjectsMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('1 project')).toBeInTheDocument();
  });
});
