'use client';

import { Button } from '@scs/ui/components/button';
import { ThemeToggle } from '@scs/ui/components/theme-toggle';
import { ChevronDown, Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { PeopleSearch } from '@/components/search/people-search';

const navigationMenus = [
  {
    id: 'staff',
    label: 'Staff',
    links: [
      { href: '/staff', label: 'All staff' },
      { href: '/staff/academic', label: 'Academic staff' },
      { href: '/staff/academic-support', label: 'Academic support' },
      { href: '/staff/non-academic', label: 'Non-academic staff' },
    ],
  },
  {
    id: 'students',
    label: 'Students',
    links: [
      { href: '/students', label: 'Student groups' },
      { href: '/students/computer-science', label: 'Computer Science' },
      { href: '/students/data-science', label: 'Data Science' },
      { href: '/students/statistics', label: 'Statistics' },
    ],
  },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const dismissMenus = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };

    document.addEventListener('pointerdown', dismissMenus);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissMenus);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-3 sm:px-4">
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-sm font-semibold"
          onClick={() => setMobileOpen(false)}
        >
          <Image
            src="/favicon/logo-symbol-icon.svg"
            alt="SCS People"
            width={40}
            height={40}
            className="size-9 object-contain"
          />
          <span className="hidden sm:inline">SCS People</span>
        </Link>

        <div className="mx-auto hidden min-w-48 flex-1 justify-center md:flex">
          <PeopleSearch />
        </div>

        <nav
          aria-label="People directory navigation"
          className="hidden items-center gap-1 md:flex"
        >
          {navigationMenus.map((menu) => {
            const active = menu.links.some((link) => isActive(link.href));
            return (
              <div className="relative" key={menu.id}>
                <Button
                  type="button"
                  variant="ghost"
                  aria-expanded={openMenu === menu.id}
                  aria-controls={`${menu.id}-menu`}
                  className={`min-h-11 border-b-2 rounded-none ${
                    active ? 'border-primary' : 'border-transparent'
                  }`}
                  onClick={() =>
                    setOpenMenu((current) =>
                      current === menu.id ? null : menu.id
                    )
                  }
                >
                  {menu.label}
                  <ChevronDown className="size-4" aria-hidden="true" />
                </Button>
                {openMenu === menu.id ? (
                  <div
                    id={`${menu.id}-menu`}
                    className="absolute top-full right-0 mt-1 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg md:right-auto md:left-0"
                  >
                    {menu.links.map((link) => {
                      const activeLink = isActive(link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          aria-current={activeLink ? 'page' : undefined}
                          className={`flex min-h-10 items-center rounded-sm border-l-2 px-3 text-sm ${
                            activeLink
                              ? 'border-primary bg-muted font-medium'
                              : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                          onClick={() => setOpenMenu(null)}
                        >
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <ThemeToggle />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
          aria-controls="people-mobile-navigation"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </div>

      <div className="mx-auto max-w-6xl px-3 pb-3 md:hidden">
        <PeopleSearch />
      </div>

      {mobileOpen ? (
        <nav
          id="people-mobile-navigation"
          aria-label="Mobile navigation"
          className="border-t bg-background px-3 py-3 md:hidden"
        >
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2">
            {navigationMenus.map((menu) => (
              <div key={menu.id}>
                <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {menu.label}
                </p>
                {menu.links.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center rounded-md border-l-2 px-3 text-sm ${
                        active
                          ? 'border-primary bg-muted font-medium'
                          : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
