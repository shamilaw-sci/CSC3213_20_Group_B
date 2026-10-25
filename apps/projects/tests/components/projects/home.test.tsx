import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Home from '@/app/_components/home';
import { fetchProjects } from '@/lib/projects/api-client';
import type { Project } from '@/lib/projects/types';

const push = vi.fn();
let currentParams = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(currentParams),
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
    categories: ['research'],
    tags: ['Accessibility'],
    departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
    academicYear: '2025/2026',
    course: {
      code: 'CSC3213',
      title: 'Software Systems Design Project',
      departments: ['STATISTICS_AND_COMPUTER_SCIENCE'],
    },
    people: [
      {
        name: 'Test Student',
        role: 'student',
        username: `e21sp${String(id).padStart(3, '0')}`,
      },
    ],
    links: {},
    source: {
      kind: 'MANUAL',
      curator: 'SCS',
    },
    media: { icon: 'FolderKanban' },
    dates: { lastUpdatedAt: '2026-10-25' },
    ...overrides,
  };
}

describe('Projects unified discovery home', () => {
  beforeEach(() => {
    currentParams = '';
    push.mockReset();
    fetchProjectsMock.mockReset();
    fetchProjectsMock.mockResolvedValue(
      Array.from({ length: 13 }, (_, index) => project(index + 1))
    );
  });

  test('presents one understandable search and filter experience', async () => {
    const { container } = render(<Home />);

    expect(
      await screen.findByRole('heading', { name: 'Find Projects' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Search Projects')).toBeInTheDocument();
    expect(
      screen.getByText(/Try a title, course code, person, or technology/u)
    ).toBeInTheDocument();

    for (const label of [
      'Category',
      'Topic',
      'Course',
      'Status',
      'Project Type',
      'Person',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    expect(
      screen.getByRole('heading', { name: 'All Projects' })
    ).toBeInTheDocument();
    expect(screen.getByText('13 projects')).toHaveAttribute(
      'aria-live',
      'polite'
    );
    expect(screen.getByRole('link', { name: 'Next' })).toBeInTheDocument();
    expect(container.querySelector('.overflow-x-auto')).toBeNull();
    expect(container.querySelector('main')).toBeNull();
  });

  test('progressively discloses secondary filters on narrow screens', async () => {
    const user = userEvent.setup();
    render(<Home />);

    const toggle = await screen.findByRole('button', { name: 'Show filters' });
    const controls = document.querySelector('#project-filter-controls');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(controls).toHaveClass('hidden', 'md:grid');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Hide filters');
    expect(controls).toHaveClass('grid');
    expect(controls).not.toHaveClass('hidden');
  });

  test('submits search text to the canonical root URL', async () => {
    const user = userEvent.setup();
    render(<Home />);
    const input = await screen.findByLabelText('Search Projects');

    await user.clear(input);
    await user.type(input, '  neural search  ');
    await user.click(screen.getByRole('button', { name: 'Search Projects' }));

    expect(push).toHaveBeenCalledWith('/?q=neural+search');
  });

  test('changes a filter with canonical URL state and resets page', async () => {
    currentParams = 'page=2';
    const user = userEvent.setup();
    render(<Home />);

    const category = await screen.findByLabelText('Category');
    category.focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');

    expect(push).toHaveBeenCalledWith('/?category=research');
  });

  test('does not confuse a real all facet with the unfiltered option', async () => {
    fetchProjectsMock.mockResolvedValueOnce([
      project(1, { categories: ['all'] }),
    ]);
    const user = userEvent.setup();
    render(<Home />);

    await user.click(await screen.findByLabelText('Category'));
    await user.click(screen.getByRole('option', { name: 'All (1)' }));

    expect(push).toHaveBeenCalledWith('/?category=all');
  });

  test('shows removable active filters and clears them together', async () => {
    currentParams = 'q=Project&status=ACTIVE&page=2';
    const user = userEvent.setup();
    render(<Home />);

    expect(
      await screen.findByRole('button', { name: 'Remove search Project' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove status Active' })
    ).toBeInTheDocument();

    const searchFilter = screen.getByRole('button', {
      name: 'Remove search Project',
    });
    expect(searchFilter).toHaveClass('max-w-full', 'overflow-hidden');
    expect(searchFilter.querySelector('span')).toHaveClass('truncate');

    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(push).toHaveBeenCalledWith('/');
  });

  test('uses singular result copy and canonical pagination links', async () => {
    currentParams = 'page=2';
    const first = render(<Home />);

    expect(await screen.findByText('13 projects')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/'
    );
    expect(screen.queryByRole('link', { name: 'Next' })).toBeNull();

    first.unmount();

    fetchProjectsMock.mockResolvedValueOnce([project(1)]);
    currentParams = '';
    const { unmount } = render(<Home />);
    expect(await screen.findByText('1 project')).toBeInTheDocument();
    unmount();
  });

  test('retries a failed registry request without losing the page', async () => {
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
    expect(await screen.findByText('1 project')).toBeInTheDocument();
  });
});
