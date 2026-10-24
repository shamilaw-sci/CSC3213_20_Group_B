'use client';

import { Button } from '@scs/ui/components/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@scs/ui/components/sheet';
import { ThemeToggle } from '@scs/ui/components/theme-toggle';
import { cn } from '@scs/ui/lib/utils';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

const navigationLinkClass =
  'flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors';

export function PortalHeader() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
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

        <ThemeToggle className="hidden md:inline-flex" />
        {!isPending ? (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              className="w-[min(22rem,calc(100vw-1rem))] p-0 md:hidden"
            >
              <SheetHeader className="border-b p-5 pr-14 text-left">
                <SheetTitle>Portal menu</SheetTitle>
                <SheetDescription>
                  {authenticated
                    ? 'Open your workspace or manage your account.'
                    : 'Sign in or create an account to use the portal.'}
                </SheetDescription>
              </SheetHeader>
              <nav
                aria-label="Portal mobile navigation"
                className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
              >
                {navigation.map((item) => (
                  <SheetClose key={item.href} asChild>
                    <PortalNavigationLink
                      item={item}
                      active={isNavigationItemActive(item.href)}
                    />
                  </SheetClose>
                ))}
              </nav>
              <SheetFooter className="border-t">
                {authenticated ? <LogoutButton /> : null}
                <ThemeToggle showLabel className="w-full justify-start" />
              </SheetFooter>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>
    </header>
  );
}

interface PortalNavigationLinkProps {
  active: boolean;
  item: PortalNavigationItem;
}

function PortalNavigationLink({ active, item }: PortalNavigationLinkProps) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        navigationLinkClass,
        active
          ? 'bg-accent text-accent-foreground'
          : `text-muted-foreground hover:bg-accent hover:text-accent-foreground
            active:bg-accent`
      )}
    >
      {item.label}
    </Link>
  );
}
