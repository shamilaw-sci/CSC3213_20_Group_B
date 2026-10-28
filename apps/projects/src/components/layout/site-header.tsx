'use client';

import { ThemeToggle } from '@scs/ui/components/theme-toggle';
import { cn } from 'cn';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SiteHeader() {
  const pathname = usePathname();
  const links = [
    { href: '/', label: 'Home', active: pathname === '/' },
    { href: '/browse', label: 'Browse', active: pathname !== '/' },
  ] as const;

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
            width={36}
            height={36}
            className="size-9 object-contain"
          />
          <span className="hidden sm:inline">SCS Projects</span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active ? 'page' : undefined}
              className={cn(
                `hover:bg-accent hover:text-accent-foreground inline-flex
                min-h-9 items-center rounded-md px-2.5 text-sm font-medium
                transition-colors sm:px-3`,
                link.active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
