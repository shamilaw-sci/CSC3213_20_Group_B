import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SiteHeader } from '@/components/layout/site-header';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@scs/ui/components/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

describe('Projects SiteHeader', () => {
  test('opens and dismisses Browse with keyboard controls', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const browse = screen.getByRole('button', { name: 'Browse' });
    expect(browse).toHaveAttribute('aria-expanded', 'false');

    await user.click(browse);
    expect(browse).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('menuitem', { name: /Courses/ })
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(browse).toHaveAttribute('aria-expanded', 'false');
  });

  test('keeps all discovery destinations in the mobile menu', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));

    for (const label of [
      'Home',
      'Search',
      'People',
      'Courses',
      'Categories',
      'Topics',
    ]) {
      expect(
        screen.getAllByRole('link', { name: new RegExp(`^${label}$`) }).length
      ).toBeGreaterThan(0);
    }
  });
});
