import type { Project } from '@scs/schemas';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProjectDirectory } from '@/components/projects/project-directory';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

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
  });

  test('renders a bounded collection with path-only pagination links', async () => {
    const projects = Array.from({ length: 13 }, (_, index) =>
      project(index + 1)
    );

    const { container } = render(
      <ProjectDirectory
        collection={{ kind: 'type', projectType: 'RESEARCH_PROJECT' }}
        page={1}
        projects={projects}
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
    render(
      <ProjectDirectory
        collection={{ kind: 'browse' }}
        page={1}
        projects={[project(1)]}
      />
    );

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
    const user = userEvent.setup();
    render(
      <ProjectDirectory
        collection={{ kind: 'browse' }}
        page={1}
        projects={[]}
      />
    );

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

  test('renders an empty state for a valid type without projects', async () => {
    render(
      <ProjectDirectory
        collection={{ kind: 'type', projectType: 'DATASET' }}
        page={1}
        projects={[project(1)]}
      />
    );
    expect(
      await screen.findByText('No Dataset projects yet')
    ).toBeInTheDocument();
  });
});
