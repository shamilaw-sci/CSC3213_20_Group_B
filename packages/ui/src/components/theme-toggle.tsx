'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { type ComponentProps, useEffect, useState } from 'react';

import { Button } from '#components/button';
import { cn } from '#lib/utils';

export interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: ComponentProps<typeof Button>['variant'];
}

export function ThemeToggle({
  className,
  showLabel = false,
  variant = 'outline',
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (
      typeof document === 'undefined' ||
      typeof MutationObserver === 'undefined'
    ) {
      return;
    }

    const root = document.documentElement;
    const updateVisibility = () => {
      setHidden(root.dataset.errorPage === 'true');
    };
    updateVisibility();

    const observer = new MutationObserver(updateVisibility);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-error-page'],
    });

    return () => observer.disconnect();
  }, []);

  if (hidden) return null;

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant={variant}
      size={showLabel ? 'default' : 'icon'}
      className={cn('shrink-0', showLabel && 'gap-2', className)}
      aria-label="Toggle color theme"
      title="Change color theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
      {showLabel ? <span>Theme</span> : null}
    </Button>
  );
}
