'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import PeopleSearch from '@/components/custom/search/PeopleSearch';
import { ThemeToggle } from '@/components/custom/theme/theme-toggle';

const staffLinks = [
  { href: '/staff/academic', label: 'Academic Staff' },
  { href: '/staff/academic-support', label: 'Academic Support' },
  { href: '/staff/non-academic', label: 'Non-Academic' },
];

const studentLinks = [
  { href: '/students/computer-science', label: 'Computer Science' },
  { href: '/students/data-science', label: 'Data Science' },
  { href: '/students/statistics', label: 'Statistics' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');
  const isStaffActive = staffLinks.some((link) => isActive(link.href));
  const isStudentActive = studentLinks.some((link) => isActive(link.href));

  const linkClass = (active: boolean) =>
    `rounded-md px-2 py-2 text-sm font-medium transition-colors sm:px-3 ${
      active
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    }`;

  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-sm">
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
          <span className="hidden sm:inline">SCS People</span>
        </Link>

        <div className="mx-2 hidden min-w-0 flex-1 justify-center md:flex">
          <PeopleSearch />
        </div>

        <nav
          className="flex min-w-0 items-center gap-0.5"
          onMouseLeave={() => setOpenMenu(null)}
          aria-label="Primary navigation"
        >
          <div className="relative" onMouseEnter={() => setOpenMenu('staff')}>
            <Link href="/staff" className={linkClass(isStaffActive)}>
              Staff
            </Link>
            {openMenu === 'staff' && (
              <div className="absolute left-0 top-full mt-1 w-48 rounded-md border bg-card py-1 shadow-lg">
                {staffLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpenMenu(null)}
                    className={`block px-4 py-2 text-sm transition-colors ${
                      isActive(link.href)
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => setOpenMenu('students')}
          >
            <Link href="/students" className={linkClass(isStudentActive)}>
              Students
            </Link>
            {openMenu === 'students' && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-md border bg-card py-1 shadow-lg sm:left-0 sm:right-auto">
                {studentLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpenMenu(null)}
                    className={`block px-4 py-2 text-sm transition-colors ${
                      isActive(link.href)
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <ThemeToggle />
        </nav>
      </div>
      <div className="mx-auto px-3 pb-2 md:hidden">
        <PeopleSearch />
      </div>
    </header>
  );
}
