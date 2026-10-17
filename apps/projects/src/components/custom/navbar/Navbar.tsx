'use client';

import { BookOpen, ChevronDown, Compass, Layers3, Tag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import ThemeToggle from '@/components/custom/ThemeToggle';
import { Button } from '@/components/ui/button';

export default function Navbar() {
  const pathname = usePathname();
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const primaryNavItems = [
    { href: '/', label: 'Home', active: pathname === '/' },
    { href: '/search', label: 'Search', active: isActive('/search') },
    { href: '/find-by', label: 'People', active: isActive('/find-by') },
  ];

  const filterNavItems = [
    {
      href: '/courses',
      label: 'Courses',
      description: 'Course-linked work',
      icon: BookOpen,
      active: isActive('/courses'),
    },
    {
      href: '/categories',
      label: 'Categories',
      description: 'Project collections',
      icon: Layers3,
      active: isActive('/categories'),
    },
    {
      href: '/topics',
      label: 'Tags',
      description: 'Subjects and tools',
      icon: Tag,
      active: isActive('/topics'),
    },
  ];

  const filterActive = filterNavItems.some((item) => item.active);

  const linkClass = (active: boolean) =>
    `rounded-md px-2 py-2 text-sm font-medium transition-colors sm:px-3 ${
      active
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    }`;

  const filterButtonClass = filterActive
    ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
    : 'text-muted-foreground hover:bg-muted hover:text-foreground';

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2.5 sm:px-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 font-bold text-card-foreground transition-colors hover:text-primary"
          >
            <Image
              src="/favicon/logo-symbol-icon.svg"
              alt="PDN Logo"
              width={48}
              height={48}
              className="h-10 w-10 object-contain sm:h-12 sm:w-12"
            />
            <span className="hidden sm:inline">SCS Projects</span>
          </Link>

          <nav
            className="flex min-w-0 items-center gap-0.5"
            aria-label="Primary navigation"
          >
            {primaryNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(item.active)}
              >
                {item.label}
              </Link>
            ))}

            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                aria-haspopup="menu"
                aria-expanded={filterMenuOpen}
                onClick={() => setFilterMenuOpen((open) => !open)}
                className={`h-auto rounded-md px-2 py-2 text-sm font-medium sm:px-3 ${filterButtonClass}`}
              >
                <Compass className="size-4" />
                <span className="hidden min-[380px]:inline">Browse</span>
                <ChevronDown
                  className={`size-3.5 transition-transform ${
                    filterMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </Button>

              {filterMenuOpen ? (
                <div
                  role="menu"
                  aria-label="Browse projects"
                  className="absolute right-0 mt-2 w-56 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg"
                >
                  {filterNavItems.map((item) => (
                    <BrowseMenuItem
                      key={item.href}
                      {...item}
                      onClick={() => setFilterMenuOpen(false)}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <ThemeToggle showLabel={false} />
          </nav>
        </div>
      </header>
      <div aria-hidden="true" className="h-15.25 shrink-0 sm:h-17.25" />
    </>
  );
}

function BrowseMenuItem({
  href,
  label,
  description,
  icon: Icon,
  active,
  onClick,
}: Readonly<{
  href: string;
  label: string;
  description: string;
  icon: typeof BookOpen;
  active: boolean;
  onClick: () => void;
}>) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </Link>
  );
}
