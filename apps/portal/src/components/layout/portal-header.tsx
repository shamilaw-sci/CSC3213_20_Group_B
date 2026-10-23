'use client';

import { Button } from '@scs/ui/components/button';
import { ThemeToggle } from '@scs/ui/components/theme-toggle';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LogoutButton } from '@/components/auth/logout-button';
import { UopLogoIcon } from '@/components/icons/uop-logo';
import { authClient } from '@/lib/auth-client';

const signedOutNavigation = [
  { href: '/login', label: 'Sign in' },
  { href: '/signup', label: 'Create account' },
] as const;

const signedInNavigation = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/user/me', label: 'Account' },
] as const;

type PortalNavigationItem =
  (typeof signedOutNavigation)[number] | (typeof signedInNavigation)[number];

export function PortalHeader() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const authenticated = Boolean(session?.user);
  const navigation = isPending
    ? []
    : authenticated
      ? signedInNavigation
      : signedOutNavigation;
  const isNavigationItemActive = (href: PortalNavigationItem['href']) =>
    href === '/user/me'
      ? pathname.startsWith('/user/me') || pathname.startsWith('/account/')
      : pathname === href;

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return (
    <header
      className="bg-background/95 supports-backdrop-filter:bg-background/85
        sticky top-0 z-40 border-b backdrop-blur"
    >
      <div
        className="mx-auto flex min-h-16 max-w-6xl items-center gap-2 px-3
          sm:px-4"
      >
        <Link
          href="/"
          className="mr-auto flex min-h-11 items-center gap-2 rounded-sm
            font-semibold"
          onClick={() => setMenuOpen(false)}
        >
          <UopLogoIcon className="size-8" />
          <span>SCS Portal</span>
        </Link>

        <nav
          aria-label="Portal navigation"
          className="hidden items-center gap-1 md:flex"
        >
          {navigation.map((item) => (
            <PortalNavigationLink
              key={item.href}
              item={item}
              active={isNavigationItemActive(item.href)}
            />
          ))}
          {!isPending && authenticated ? <LogoutButton /> : null}
        </nav>

        <ThemeToggle />
        {!isPending ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="portal-mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        ) : null}
      </div>

      {menuOpen ? (
        <nav
          id="portal-mobile-navigation"
          aria-label="Portal mobile navigation"
          className="bg-background border-t p-3 md:hidden"
        >
          <div className="mx-auto grid max-w-6xl gap-1">
            {navigation.map((item) => (
              <PortalNavigationLink
                key={item.href}
                item={item}
                active={isNavigationItemActive(item.href)}
                onSelect={() => setMenuOpen(false)}
                className="justify-start border-b-0 border-l-2"
              />
            ))}
            {!isPending && authenticated ? <LogoutButton /> : null}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

interface PortalNavigationLinkProps {
  active: boolean;
  className?: string;
  item: PortalNavigationItem;
  onSelect?: () => void;
}

function PortalNavigationLink({
  active,
  className,
  item,
  onSelect,
}: PortalNavigationLinkProps) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={onSelect}
      className={`flex min-h-11 items-center rounded-sm border-b-2 px-3 text-sm
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
