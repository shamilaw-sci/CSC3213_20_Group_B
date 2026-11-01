import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SiteHeader } from '@/components/layout/site-header';

let pathname = '/research';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

describe('SiteHeader', () => {
  beforeEach(() => {
    pathname = '/research';
  });

  test('identifies the department home link', () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole('link', { name: 'SCS department home' })
    ).toHaveAttribute('href', '/');
    expect(
      screen.getByRole('img', { name: 'University of Peradeniya crest' })
    ).toHaveAttribute('src', expect.stringContaining('logo-symbol-icon.svg'));
  });

  test('marks the current department route in desktop and mobile navigation', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Research' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    await user.click(
      screen.getByRole('button', { name: 'Open department navigation' })
    );

    expect(screen.getByRole('link', { name: 'Research' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('provides an accessible mobile navigation trigger', () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole('button', { name: 'Open department navigation' })
    ).toBeInTheDocument();
  });

  test('keeps secondary destinations globally reachable and marks local routes active', async () => {
    const user = userEvent.setup();
    pathname = '/services';
    render(<SiteHeader />);

    await user.click(screen.getByRole('button', { name: 'More' }));

    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(
      screen.getByRole('link', { name: /project showcase/i })
    ).toHaveAttribute('href', 'https://projects.scs-pdn.space');
  });

  test('dismisses the More popover with Escape and restores trigger focus', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    const trigger = screen.getByRole('button', { name: 'More' });

    await user.click(trigger);
    expect(
      screen.getByRole('link', { name: /project showcase/i })
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        screen.queryByRole('link', { name: /project showcase/i })
      ).toBeNull();
    });
    expect(trigger).toHaveFocus();
  });

  test('keeps mobile navigation as links and closes after navigation', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(
      screen.getByRole('button', { name: 'Open department navigation' })
    );
    const sheet = screen.getByRole('dialog', { name: 'Department menu' });
    const mobileResearchLink = within(sheet).getByRole('link', {
      name: 'Research',
    });

    expect(mobileResearchLink).not.toHaveAttribute('role', 'button');
    mobileResearchLink.addEventListener('click', (event) =>
      event.preventDefault()
    );
    await user.click(mobileResearchLink);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
