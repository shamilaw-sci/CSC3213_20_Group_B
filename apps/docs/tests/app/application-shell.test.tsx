import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import DocumentationLoading from '@/app/docs/[[...slug]]/loading';
import { DocsHome } from '@/components/layout/docs-home';
import { baseOptions } from '@/lib/layout.shared';

describe('documentation home shell', () => {
  test('leaves the main landmark to HomeLayout and keeps semantic headings', () => {
    const { container } = render(<DocsHome />);

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(container.firstElementChild?.tagName).toBe('DIV');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'SCS PDN Cookbook',
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

describe('documentation navigation shell', () => {
  test('reserves the Fumadocs content grid while a page loads', () => {
    const { container } = render(<DocumentationLoading />);

    const main = screen.getByRole('main');

    expect(main).toHaveAttribute('data-layout-main');
    expect(main).toHaveClass('[grid-area:main]');
    expect(container.querySelector('#nd-toc-placeholder')).toBeInTheDocument();
  });

  test('shows a fixed-size university brand in the navbar', () => {
    const title = baseOptions().nav?.title;
    render(<>{typeof title === 'function' ? null : title}</>);

    expect(
      screen.getByRole('img', { name: 'University of Peradeniya crest' })
    ).toHaveAttribute('width', '32');
    expect(
      screen.getByRole('img', { name: 'University of Peradeniya crest' })
    ).toHaveAttribute('height', '32');
    expect(screen.getByText('SCS Documentation')).toBeInTheDocument();
  });

  test('links directly to the main repository without a selector', () => {
    expect(baseOptions().nav?.children).toBeUndefined();
    expect(baseOptions().githubUrl).toBe(
      'https://github.com/csc3213-2026-group-b/scs-pdn-monorepo'
    );
  });
});
