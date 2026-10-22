/** Keeps standalone error pages synchronized with next-themes before hydration. */
function initializeTheme() {
  const root = document.documentElement;
  if (!root) return;

  const systemPrefersDark = () => {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  };

  const storedTheme = () => {
    try {
      const value = localStorage.getItem('theme');
      return value === 'dark' || value === 'light' ? value : null;
    } catch {
      return null;
    }
  };

  const applyTheme = () => {
    const stored = storedTheme();
    const useDarkTheme = stored === 'dark' || (!stored && systemPrefersDark());
    root.classList.toggle('dark', useDarkTheme);
  };

  applyTheme();

  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', applyTheme);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(applyTheme);
    }
  } catch {
    // The initial explicit or light theme remains valid without media queries.
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'theme') applyTheme();
  });
}

export const THEME_INIT_SCRIPT = `(${initializeTheme.toString()})();`;

export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
