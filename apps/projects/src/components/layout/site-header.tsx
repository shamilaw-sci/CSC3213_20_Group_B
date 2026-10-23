'use client';

import { Button } from '@scs/ui/components/button';
import { ThemeToggle } from '@scs/ui/components/theme-toggle';
import {
  BookOpen,
  ChevronDown,
  Compass,
  Layers3,
  Menu,
  Tag,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const primaryNavigation = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Search' },
  { href: '/find-by', label: 'People' },
] as const;

const browseNavigation = [
  {
    href: '/courses',
    label: 'Courses',
    description: 'Course-linked work',
    icon: BookOpen,
  },
  {
    href: '/categories',
    label: 'Categories',
    description: 'Project collections',
    icon: Layers3,
  },
  {
    href: '/topics',
    label: 'Topics',
    description: 'Subjects and tools',
    icon: Tag,
  },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const dismissMenus = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setBrowseOpen(false);
        setMobileOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setBrowseOpen(false);
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
    href === '/'
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  const browseActive = browseNavigation.some((item) => isActive(item.href));

  return (
    <header
      ref={headerRef}
      className="bg-background/95 supports-[backdrop-filter]:bg-background/85
        sticky top-0 z-40 border-b backdrop-blur"
    >
      <div
        className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-3
          sm:px-4"
      >
        <Link
          href="/"
          className="mr-auto flex min-h-11 shrink-0 items-center gap-2
            rounded-sm font-semibold"
          onClick={() => setMobileOpen(false)}
        >
          <Image
            src="/favicon/logo-symbol-icon.svg"
            alt="SCS Projects"
            width={40}
            height={40}
            className="size-9 object-contain"
          />
          <span className="hidden sm:inline">SCS Projects</span>
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Project discovery navigation"
        >
          {primaryNavigation.map((item) => {
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

          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              aria-haspopup="menu"
              aria-expanded={browseOpen}
              aria-controls="projects-browse-menu"
              onClick={() => setBrowseOpen((open) => !open)}
              className={`min-h-11 rounded-none border-b-2 ${
                browseActive ? 'border-primary' : 'border-transparent'
              }`}
            >
              <Compass aria-hidden="true" />
              Browse
              <ChevronDown
                className={`size-4 transition-transform ${
                  browseOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </Button>

            {browseOpen ? (
              <div
                id="projects-browse-menu"
                role="menu"
                aria-label="Browse projects"
                className="bg-popover text-popover-foreground absolute top-full
                  right-0 mt-1 max-h-[min(24rem,calc(100vh-6rem))] w-64
                  overflow-y-auto rounded-md border p-1 shadow-lg"
              >
                {browseNavigation.map((item) => (
                  <BrowseLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    onSelect={() => setBrowseOpen(false)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </nav>

        <ThemeToggle />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
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
          className="bg-background max-h-[min(24rem,calc(100vh-5rem))]
            overflow-y-auto border-t px-3 py-3 md:hidden"
        >
          <div className="mx-auto grid max-w-6xl gap-1 sm:grid-cols-2">
            {[...primaryNavigation, ...browseNavigation].map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center rounded-md border-l-2
                    px-3 text-sm font-medium ${
                      active
                        ? 'border-primary bg-muted'
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

interface BrowseLinkProps {
  active: boolean;
  item: (typeof browseNavigation)[number];
  onSelect: () => void;
}

function BrowseLink({ active, item, onSelect }: BrowseLinkProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      role="menuitem"
      aria-current={active ? 'page' : undefined}
      onClick={onSelect}
      className={`flex min-h-14 items-center gap-3 rounded-sm border-l-2 px-3
        py-2 ${
          active
            ? 'border-primary bg-muted'
            : `text-muted-foreground hover:bg-muted hover:text-foreground
              border-transparent`
        }`}
    >
      <Icon className="text-primary size-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="block text-sm font-semibold">{item.label}</span>
        <span className="text-muted-foreground block text-xs">
          {item.description}
        </span>
      </span>
    </Link>
  );
}
