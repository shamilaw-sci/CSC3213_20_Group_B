import type { ComponentProps } from 'react';

import { cn } from '#lib/utils';

function SkipLink({
  children = 'Skip to main content',
  className,
  href = '#main-content',
  ...props
}: ComponentProps<'a'>) {
  return (
    <a
      href={href}
      className={cn(
        `bg-primary text-primary-foreground fixed top-3 left-3 z-50
        -translate-y-20 rounded-md px-4 py-2 text-sm font-semibold shadow-md
        transition-transform focus-visible:translate-y-0`,
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export { SkipLink };
