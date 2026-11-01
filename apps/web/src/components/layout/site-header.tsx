'use client';

import { Button } from '@scs/ui/components/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@scs/ui/components/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@scs/ui/components/sheet';
import { ThemeToggle } from '@scs/ui/components/theme-toggle';
import { cn } from '@scs/ui/lib/utils';
import { ArrowUpRight, ChevronDown, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { DepartmentMark } from '@/components/layout/department-mark';
import { AppLink } from '@/components/navigation/app-link';
import {
  primaryNavigation,
  secondaryNavigation,
} from '@/config/navigation.config';

const navigationLinkClass =
  'flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors';

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const isActive = (href: string) =>
    href === '/' ? pathname === href : pathname.startsWith(href);
  const secondaryActive = secondaryNavigation.some(
    (item) => item.destination === 'local' && isActive(item.href)
  );

  return (
    <header
      className="bg-background/95 supports-backdrop-filter:bg-background/85
        sticky top-0 z-40 border-b backdrop-blur"
    >
      <div
        className="mx-auto flex min-h-20 max-w-7xl items-center gap-3 px-3
          sm:px-4 lg:px-6"
      >
        <Link
          href="/"
          aria-label="SCS department home"
          className="mr-auto flex min-h-11 max-w-sm min-w-0 items-center
            rounded-sm"
        >
          <DepartmentMark />
        </Link>

        <nav
          aria-label="Department navigation"
          className="hidden items-center gap-0.5 xl:flex"
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

        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  'hidden xl:inline-flex',
                  secondaryActive && 'bg-accent text-accent-foreground'
                )}
                aria-label="More"
              />
            }
          >
            More
            <ChevronDown aria-hidden="true" className="size-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2">
            <nav aria-label="More department navigation">
              {secondaryNavigation.map((item) => {
                const active =
                  item.destination === 'local' && isActive(item.href);
                return (
                  <AppLink
                    key={item.href}
                    href={item.href}
                    destination={item.destination}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      navigationLinkClass,
                      active
                        ? 'bg-accent text-accent-foreground'
                        : `text-muted-foreground hover:bg-accent
                          hover:text-accent-foreground`
                    )}
                  >
                    <span>{item.label}</span>
                    {item.destination === 'external-product' ? (
                      <ArrowUpRight
                        aria-hidden="true"
                        className="ml-auto size-4"
                      />
                    ) : null}
                  </AppLink>
                );
              })}
            </nav>
          </PopoverContent>
        </Popover>

        <ThemeToggle className="hidden xl:inline-flex" />
        <Sheet
          open={mobileNavigationOpen}
          onOpenChange={setMobileNavigationOpen}
        >
          <SheetTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="xl:hidden"
                aria-label="Open department navigation"
              />
            }
          >
            <Menu aria-hidden="true" />
          </SheetTrigger>
          <SheetContent
            className="w-[min(23rem,calc(100vw-1rem))] p-0 xl:hidden"
          >
            <SheetHeader className="border-b p-5 pr-14 text-left">
              <SheetTitle>Department menu</SheetTitle>
              <SheetDescription>
                Study, research, facilities, services, and department contacts.
              </SheetDescription>
            </SheetHeader>
            <nav
              aria-label="Mobile department navigation"
              className="flex flex-1 flex-col overflow-y-auto p-3"
            >
              <p
                className="text-muted-foreground px-3 pb-2 text-xs font-semibold
                  tracking-wider uppercase"
              >
                Department
              </p>
              <div className="flex flex-col gap-1">
                {primaryNavigation.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <AppLink
                      key={item.href}
                      href={item.href}
                      destination={item.destination}
                      onClick={() => setMobileNavigationOpen(false)}
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
                    </AppLink>
                  );
                })}
              </div>

              <p
                className="text-muted-foreground mt-5 px-3 pb-2 text-xs
                  font-semibold tracking-wider uppercase"
              >
                More
              </p>
              <div className="flex flex-col gap-1">
                {secondaryNavigation.map((item) => {
                  const active =
                    item.destination === 'local' && isActive(item.href);
                  return (
                    <AppLink
                      key={item.href}
                      href={item.href}
                      destination={item.destination}
                      onClick={() => setMobileNavigationOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        navigationLinkClass,
                        active
                          ? 'bg-accent text-accent-foreground'
                          : `text-muted-foreground hover:bg-accent
                            hover:text-accent-foreground active:bg-accent`
                      )}
                    >
                      <span>{item.label}</span>
                      {item.destination === 'external-product' ? (
                        <ArrowUpRight
                          aria-hidden="true"
                          className="ml-auto size-4"
                        />
                      ) : null}
                    </AppLink>
                  );
                })}
              </div>
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
