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
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { href: '/search', label: 'Search' },
  { href: '/find-by', label: 'People' },
  { href: '/courses', label: 'Courses' },
  { href: '/categories', label: 'Categories' },
  { href: '/topics', label: 'Topics' },
] as const;

const navigationLinkClass =
  'flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors';

export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

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

        <ThemeToggle className="hidden lg:inline-flex" />
        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
            >
              <Menu aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent
            className="w-[min(22rem,calc(100vw-1rem))] p-0 lg:hidden"
          >
            <SheetHeader className="border-b p-5 pr-14 text-left">
              <SheetTitle>Explore projects</SheetTitle>
              <SheetDescription>
                Search the registry or browse projects by people and academic
                context.
              </SheetDescription>
            </SheetHeader>
            <nav
              aria-label="Mobile navigation"
              className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
            >
              {navigation.map((item) => {
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
