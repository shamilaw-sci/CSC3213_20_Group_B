import { render, screen, waitFor, within } from '@testing-library/react';

import ProjectDetailPage from '@/app/projects/[project_slug]/_components/project-detail-page';
import { ProjectDetail, ProjectGrid } from '@/components/projects/registry-ui';
import { fetchProject, fetchProjects } from '@/lib/projects/api-client';
import type { Project } from '@/lib/projects/types';

vi.mock('@/lib/projects/api-client', () => ({
  fetchProject: vi.fn(),
  fetchProjects: vi.fn(),
  ProjectDataNotFoundError: class ProjectDataNotFoundError extends Error {},
}));

const fetchProjectMock = vi.mocked(fetchProject);
const fetchProjectsMock = vi.mocked(fetchProjects);

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'clear-project',
    slug: 'clear-project',
    title: 'A Very Clear Project',
    shortDescription:
      'A concise explanation that can wrap to a second line without changing the card action.',
    description: 'A complete explanation of the work and its intended outcome.',
    projectType: 'COURSE_PROJECT',
    status: 'ACTIVE',
    categories: ['student-innovation'],
    tags: ['Accessibility', 'Next.js', 'User research'],
    departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
    academicYear: '2025/2026',
    course: {
      code: 'CSC3213',
      title: 'Software Systems Design Project',
      departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
    },
    batch: 'E21',
    people: [
      {
        name: 'Shamila Weerakoon',
        role: 'supervisor',
        username: 'shamilaw',
      },
    ],
    links: {},
    source: { kind: 'MANUAL', curator: 'SCS' },
    media: { icon: 'FolderKanban' },
    dates: { lastUpdatedAt: '2026-07-26' },
    ...overrides,
  };
}

describe('Project presentation', () => {
  beforeEach(() => {
    fetchProjectMock.mockReset();
    fetchProjectsMock.mockReset();
  });

  test('makes each compact project card one clear, contained link', () => {
    const { container } = render(<ProjectGrid projects={[project()]} />);
    const cardLink = screen.getByRole('link', {
      name: 'A Very Clear Project',
    });

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(cardLink).toHaveAttribute('href', '/projects/clear-project');
    expect(screen.queryByText('View')).toBeNull();
    expect(screen.getByText(project().shortDescription)).toHaveClass(
      'line-clamp-2'
    );
    expect(screen.getByText('Course Project')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('CSC3213')).toBeInTheDocument();
    expect(screen.getByText('2025/2026')).toBeInTheDocument();
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByText('Next.js')).toBeInTheDocument();
    expect(screen.queryByText('User research')).toBeNull();
    expect(screen.queryByText(/topics/u)).toBeNull();
    expect(cardLink).toHaveClass('min-w-0', 'overflow-hidden');
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });

  test('uses canonical discovery links and omits facts that do not exist', () => {
    const minimalProject = project({
      academicYear: undefined,
      batch: undefined,
      course: undefined,
      departments: [],
    });
    render(<ProjectDetail project={minimalProject} />);

    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb' })
    ).toHaveTextContent(/Projects.*A Very Clear Project/u);
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/'
    );
    expect(
      screen.getByRole('link', { name: 'student innovation' })
    ).toHaveAttribute('href', '/?category=student-innovation');
    expect(screen.getByRole('link', { name: 'Accessibility' })).toHaveAttribute(
      'href',
      '/?topic=accessibility'
    );
    expect(screen.queryByText('Optional')).toBeNull();
    expect(screen.queryByText('Academic year')).toBeNull();
    expect(screen.queryByText('Course')).toBeNull();
    expect(screen.queryByText('Departments')).toBeNull();
    expect(screen.queryByText('Batch')).toBeNull();
  });

  test('shows project-scoped roles and a readable localized date', () => {
    render(<ProjectDetail project={project()} />);

    const team = screen
      .getByRole('heading', { name: 'People' })
      .closest('[data-slot="card"]');
    expect(team).not.toBeNull();
    expect(
      within(team as HTMLElement).getByText('Supervisor')
    ).toBeInTheDocument();
    expect(screen.queryByText('Project contributor')).toBeNull();
    expect(screen.getByText('26 Jul 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CSC3213' })).toHaveAttribute(
      'href',
      '/?course=CSC3213'
    );
  });

  test('does not render an empty related-project section', async () => {
    const selectedProject = project();
    fetchProjectMock.mockResolvedValue(selectedProject);
    fetchProjectsMock.mockResolvedValue([selectedProject]);

    render(<ProjectDetailPage projectSlug={selectedProject.slug} />);

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: selectedProject.title })
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByRole('heading', { name: /Related Projects/iu })
    ).toBeNull();
  });
});
