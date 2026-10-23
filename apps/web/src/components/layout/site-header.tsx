'use client';

import { Button } from '@scs/ui/components/button';
import { ThemeToggle } from '@scs/ui/components/theme-toggle';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

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
  'flex min-h-11 items-center rounded-sm border-b-2 px-1 text-sm font-medium transition-colors';

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const isActive = (href: string) =>
    href === '/' ? pathname === href : pathname.startsWith(href);

  return (
    <header
      className="bg-background/95 supports-backdrop-filter:bg-background/85
        sticky top-0 z-40 border-b backdrop-blur"
    >
      <div
        className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-4
          sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="mr-auto flex min-h-11 items-center rounded-sm"
          onClick={() => setMenuOpen(false)}
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
          className="hidden items-stretch gap-4 xl:flex"
        >
          {primaryNavigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`${navigationLinkClass} ${
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
          className="xl:hidden"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="web-mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </div>

      {menuOpen ? (
        <nav
          id="web-mobile-navigation"
          aria-label="Mobile navigation"
          className="bg-background border-t px-4 py-3 xl:hidden"
        >
          <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
            {primaryNavigation.map((item) => {
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
                  onClick={() => setMenuOpen(false)}
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
