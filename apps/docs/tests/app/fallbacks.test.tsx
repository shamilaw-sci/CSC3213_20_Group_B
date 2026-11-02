import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

import ErrorPage from '@/app/error';
import GlobalError from '@/app/global-error';
import GlobalNotFound from '@/app/global-not-found';
import NotFound from '@/app/not-found';

describe('documentation fallbacks', () => {
  test('offers a clear recovery path for missing pages', () => {
    render(<NotFound />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Documentation page not found' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open the handbook' })
    ).toHaveAttribute('href', '/docs');
  });

  test('keeps segment errors retryable', async () => {
    const reset = vi.fn();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<ErrorPage error={new Error('test')} reset={reset} />);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  test('shows the university crest on every missing or failed page', () => {
    const fallbacks = [
      <NotFound key="not-found" />,
      <GlobalNotFound key="global-not-found" />,
      <GlobalError
        key="global-error"
        error={new Error('test')}
        reset={() => undefined}
      />,
    ];

    for (const fallback of fallbacks) {
      expect(renderToStaticMarkup(fallback)).toContain(
        'src="/favicon/logo-symbol-icon.svg"'
      );
    }
  });
});
