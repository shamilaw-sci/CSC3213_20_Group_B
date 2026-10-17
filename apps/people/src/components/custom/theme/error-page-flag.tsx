'use client';

import { useEffect } from 'react';

/**
 * Marks the current page as an error/404 page.
 * so global UI elements (like ThemeToggle) can hide themselves.
 */
export function ErrorPageFlag() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const previous = root.dataset.errorPage;

    root.dataset.errorPage = 'true';

    return () => {
      if (previous !== undefined) {
        root.dataset.errorPage = previous;
      } else {
        delete root.dataset.errorPage;
      }
    };
  }, []);

  return null;
}
