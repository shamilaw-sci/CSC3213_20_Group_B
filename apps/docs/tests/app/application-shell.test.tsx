import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { DocsHome } from '@/components/layout/docs-home';

describe('documentation home shell', () => {
  test('has one main landmark and a semantic heading hierarchy', () => {
    render(<DocsHome />);

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'One handbook for the whole system.',
      })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
  });

  test('makes handbook destinations keyboard reachable', async () => {
    const user = userEvent.setup();
    render(<DocsHome />);

    await user.tab();
    expect(screen.getByRole('link', { name: /Start here/u })).toHaveFocus();
  });
});
