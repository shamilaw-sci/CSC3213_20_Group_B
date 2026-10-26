import { cn } from '@scs/ui/lib/utils';
import type { ComponentProps } from 'react';

export function PageShell({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8',
        className
      )}
      {...props}
    />
  );
}
