function themeInit() {
  try {
    const root = document.documentElement;
    if (!root) return;

    const applyTheme = () => {
      try {
        const storedTheme = localStorage.getItem('theme');
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const useDarkTheme =
          storedTheme === 'dark' ||
          (storedTheme !== 'light' && mediaQuery.matches);

        root.classList.toggle('dark', useDarkTheme);
      } catch {
        // Keep error pages renderable if browser theme APIs are unavailable.
      }
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', applyTheme);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(applyTheme);
    }

    window.addEventListener('storage', (event) => {
      if (event.key === 'theme') {
        applyTheme();
      }
    });
  } catch {
    // Fail silently so emergency pages never block on theme setup.
  }
}

const themeInitScript = `(${themeInit.toString()})();`;

export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}
