'use client';

import { Button } from '@scs/ui/components/button';
import { cn } from 'cn';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function ThemeToggle({
  className,
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [hideForErrorPage, setHideForErrorPage] = useState(false);

  useEffect(() => {
    if (
      typeof document === 'undefined' ||
      typeof MutationObserver === 'undefined'
    ) {
      return;
    }

    const root = document.documentElement;

    const updateVisibility = () => {
      const isErrorPage = root.dataset.errorPage === 'true';
      setHideForErrorPage(isErrorPage);
      setMounted(true);
    };

    updateVisibility();

    const observer = new MutationObserver(updateVisibility);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-error-page'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const dark = mounted && resolvedTheme === 'dark';

  if (!mounted || hideForErrorPage) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? 'default' : 'icon'}
      aria-pressed={dark}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      suppressHydrationWarning
      className={cn(showLabel ? 'gap-2' : 'ml-0.5 shrink-0', className)}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {showLabel ? <span>{dark ? 'Light' : 'Dark'}</span> : null}
    </Button>
  );
}
