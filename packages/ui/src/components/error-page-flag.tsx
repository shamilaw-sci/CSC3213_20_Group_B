'use client';

import { useEffect } from 'react';

export function ErrorPageFlag() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const previous = root.dataset.errorPage;
    root.dataset.errorPage = 'true';

    return () => {
      if (previous === undefined) delete root.dataset.errorPage;
      else root.dataset.errorPage = previous;
    };
  }, []);

  return null;
}
