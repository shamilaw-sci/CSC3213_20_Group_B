'use client';

import { ThemeToggle } from '@scs/ui/components/theme-toggle';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { UopLogoIcon } from '@/components/icons/uop-logo';

const publicNavigation = [
  { href: '/', label: 'Portal home' },
  { href: '/login', label: 'Sign in' },
  { href: '/signup', label: 'Create account' },
] as const;

export function PortalHeader() {
  const pathname = usePathname();

  return (
    <header
      className="bg-background/95 supports-backdrop-filter:bg-background/85
        sticky top-0 z-40 border-b backdrop-blur"
    >
      <div
        className="mx-auto flex min-h-14 max-w-6xl items-center gap-2 px-3
          sm:px-4"
      >
        <Link
          href="/"
          className="mr-auto flex min-h-11 items-center gap-2 rounded-sm
            font-semibold"
        >
          <UopLogoIcon className="size-8" />
          <span>SCS Portal</span>
        </Link>
        <nav aria-label="Portal navigation" className="flex items-center gap-1">
          {publicNavigation.map((item) => (
            <PortalNavigationLink
              key={item.href}
              item={item}
              active={pathname === item.href}
              className="hidden sm:flex"
            />
          ))}
        </nav>
        <ThemeToggle />
      </div>
      <nav
        aria-label="Portal mobile navigation"
        className="flex gap-1 overflow-x-auto border-t px-3 py-1 sm:hidden"
      >
        {publicNavigation.map((item) => (
          <PortalNavigationLink
            key={item.href}
            item={item}
            active={pathname === item.href}
            className="shrink-0"
          />
        ))}
      </nav>
    </header>
  );
}

interface PortalNavigationLinkProps {
  active: boolean;
  className?: string;
  item: (typeof publicNavigation)[number];
}

function PortalNavigationLink({
  active,
  className,
  item,
}: PortalNavigationLinkProps) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-10 items-center rounded-md border-b-2 px-3 text-sm
        font-medium transition-colors ${
          active
            ? 'border-primary bg-muted text-foreground'
            : `text-muted-foreground hover:bg-muted hover:text-foreground
              border-transparent`
        } ${className ?? ''}`}
    >
      {item.label}
    </Link>
  );
}
