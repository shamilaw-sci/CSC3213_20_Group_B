import { ThemeToggle } from '@scs/ui/components/theme-toggle';
import Link from 'next/link';

import { UopLogoIcon } from '@/components/icons/uop-logo';

const publicNavigation = [
  { href: '/', label: 'Portal home' },
  { href: '/login', label: 'Sign in' },
  { href: '/signup', label: 'Create account' },
] as const;

export function PortalHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-2 px-3 sm:px-4">
        <Link
          href="/"
          className="mr-auto flex min-h-11 items-center gap-2 rounded-sm font-semibold focus-visible:outline-none"
        >
          <UopLogoIcon className="size-8" />
          <span>SCS Portal</span>
        </Link>
        <nav aria-label="Portal navigation" className="flex items-center gap-1">
          {publicNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden min-h-10 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none sm:flex"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
      <nav
        aria-label="Portal mobile navigation"
        className="flex gap-1 overflow-x-auto border-t px-3 py-1 sm:hidden"
      >
        {publicNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-10 shrink-0 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
