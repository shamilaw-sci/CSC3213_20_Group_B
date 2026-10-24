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

const primaryNavigation = [
  { href: '/', label: 'Home' },
  { href: '/about-us', label: 'About' },
  { href: '/undergraduate-courses', label: 'Undergraduate' },
  { href: '/postgraduate-courses', label: 'Postgraduate' },
  { href: '/research', label: 'Research' },
  { href: '/people', label: 'People' },
  { href: '/contact', label: 'Contact' },
] as const;

const navigationLinkClass =
  'flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors';

export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === href : pathname.startsWith(href);

  return (
    <header
      className="bg-background/95 supports-backdrop-filter:bg-background/85
        sticky top-0 z-40 border-b backdrop-blur"
    >
      <div
        className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4
          sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="mr-auto flex min-h-11 items-center rounded-sm"
        >
          <span
            className="bg-primary text-primary-foreground flex size-9
              items-center justify-center rounded-md text-sm font-bold
              tracking-tight"
          >
            SCS
          </span>
          <span className="ml-3 hidden leading-tight sm:block">
            <span className="block text-sm font-semibold">
              Statistics &amp; Computer Science
            </span>
            <span className="text-muted-foreground block text-xs">
              University of Peradeniya
            </span>
          </span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-1 xl:flex"
        >
          {primaryNavigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  navigationLinkClass,
                  active
                    ? 'bg-accent text-accent-foreground'
                    : `text-muted-foreground hover:bg-accent
                      hover:text-accent-foreground`
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle className="hidden xl:inline-flex" />
        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="xl:hidden"
              aria-label="Open navigation"
            >
              <Menu aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent
            className="w-[min(22rem,calc(100vw-1rem))] p-0 xl:hidden"
          >
            <SheetHeader className="border-b p-5 pr-14 text-left">
              <SheetTitle>Department menu</SheetTitle>
              <SheetDescription>
                Explore the department, programmes, research, and people.
              </SheetDescription>
            </SheetHeader>
            <nav
              aria-label="Mobile navigation"
              className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
            >
              {primaryNavigation.map((item) => {
                const active = isActive(item.href);
                return (
                  <SheetClose key={item.href} asChild>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        navigationLinkClass,
                        active
                          ? 'bg-accent text-accent-foreground'
                          : `text-muted-foreground hover:bg-accent
                            hover:text-accent-foreground active:bg-accent`
                      )}
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>
            <SheetFooter className="border-t">
              <ThemeToggle showLabel className="w-full justify-start" />
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
