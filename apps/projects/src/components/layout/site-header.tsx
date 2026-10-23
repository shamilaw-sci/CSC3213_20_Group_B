'use client';

import { Button } from '@scs/ui/components/button';
import { ThemeToggle } from '@scs/ui/components/theme-toggle';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navigation = [
  { href: '/search', label: 'Search' },
  { href: '/find-by', label: 'People' },
  { href: '/courses', label: 'Courses' },
  { href: '/categories', label: 'Categories' },
  { href: '/topics', label: 'Topics' },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  const isActive = (href: string) =>
    href === '/'
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className="bg-background/95 supports-backdrop-filter:bg-background/85
        sticky top-0 z-40 border-b backdrop-blur"
    >
      <div
        className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-3
          sm:px-4"
      >
        <Link
          href="/"
          aria-label="SCS Projects home"
          className="mr-auto flex min-h-11 shrink-0 items-center gap-2
            rounded-sm font-semibold"
          onClick={() => setMobileOpen(false)}
        >
          <Image
            src="/favicon/logo-symbol-icon.svg"
            alt=""
            width={40}
            height={40}
            className="size-9 object-contain"
          />
          <span className="hidden sm:inline">SCS Projects</span>
        </Link>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Project discovery navigation"
        >
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center rounded-sm border-b-2
                px-3 text-sm font-medium ${
                  active
                    ? 'border-primary text-foreground'
                    : `text-muted-foreground hover:border-border
                      hover:text-foreground border-transparent`
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
          aria-controls="projects-mobile-navigation"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </div>

      {mobileOpen ? (
        <nav
          id="projects-mobile-navigation"
          aria-label="Mobile navigation"
          className="bg-background border-t p-3 lg:hidden"
        >
          <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center rounded-md border-l-2
                    px-3 text-sm font-medium ${
                      active
                        ? 'border-primary bg-muted text-foreground'
                        : `text-muted-foreground hover:bg-muted
                          hover:text-foreground border-transparent`
                    }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
