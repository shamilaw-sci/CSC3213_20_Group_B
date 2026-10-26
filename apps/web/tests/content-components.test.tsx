import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => (
    <a data-next-link="true" {...props}>
      {children}
    </a>
  ),
}));

import { PathwayLinks } from '@/app/_components/pathway-links';
import { QuickLinks } from '@/app/_components/quick-links';
import { PageIntro } from '@/components/content/page-intro';
import { PageSection } from '@/components/content/page-section';
import { PageShell } from '@/components/content/page-shell';
import { DepartmentPageLoading } from '@/components/feedback/page-loading';

describe('department content components', () => {
  test('renders an editorial page introduction with one primary action', () => {
    render(
      <PageIntro
        eyebrow="Department of"
        title="Statistics & Computer Science"
        description="Education, research, and community outreach."
        action={{ href: '/about-us', label: 'About our department' }}
      />
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Statistics & Computer Science',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'About our department' })
    ).toHaveAttribute('href', '/about-us');
  });

  test('uses a native document link for an external page action', () => {
    render(
      <PageIntro
        eyebrow="Research"
        title="Research at the department"
        description="Research activity and project work."
        action={{
          href: 'https://projects.scs-pdn.space',
          label: 'Explore project work',
        }}
      />
    );

    expect(
      screen.getByRole('link', { name: 'Explore project work' })
    ).not.toHaveAttribute('data-next-link');
  });

  test('renders the three primary study and research pathways', () => {
    render(<PathwayLinks />);

    expect(
      screen.getByRole('link', { name: /undergraduate programmes/i })
    ).toHaveAttribute('href', '/undergraduate-courses');
    expect(
      screen.getByRole('link', { name: /postgraduate study/i })
    ).toHaveAttribute('href', '/postgraduate-courses');
    expect(
      screen.getByRole('link', { name: /research and innovation/i })
    ).toHaveAttribute('href', '/research');
  });

  test('keeps related products clearly labelled in quick links', () => {
    render(<QuickLinks />);

    expect(
      screen.getByRole('link', { name: /people directory.*external/i })
    ).toHaveAttribute('href', 'https://people.scs-pdn.space');
    expect(
      screen.getByRole('link', { name: /project showcase.*external/i })
    ).toHaveAttribute('href', 'https://projects.scs-pdn.space');
    expect(
      screen.getByRole('link', { name: /people directory.*external/i })
    ).not.toHaveAttribute('data-next-link');
  });

  test('composes long-form sections inside the shared page width', () => {
    render(
      <PageShell>
        <PageSection eyebrow="About us" title="A long-standing commitment">
          <p>Department history</p>
        </PageSection>
      </PageShell>
    );

    expect(
      screen.getByRole('heading', { name: 'A long-standing commitment' })
    ).toBeInTheDocument();
    expect(screen.getByText('Department history')).toBeInTheDocument();
  });

  test('uses a content-shaped loading state for department pages', () => {
    render(<DepartmentPageLoading />);

    expect(
      screen.getByRole('status', { name: 'Loading department page' })
    ).toHaveAttribute('aria-busy', 'true');
  });
});
