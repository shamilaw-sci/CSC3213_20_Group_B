import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider } from '@/components/custom/theme/theme-provider';
import ThemeToggle from '@/components/custom/ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
    localStorage.clear();
  });

  test('toggles and persists dark mode', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const user = userEvent.setup();
    const toggle = await screen.findByRole('button', {
      name: 'Switch to dark theme',
    });

    await user.click(toggle);

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
      expect(localStorage.getItem('theme')).toBe('dark');
      expect(
        screen.getByRole('button', { name: 'Switch to light theme' })
      ).toBeInTheDocument();
    });
  });
});
