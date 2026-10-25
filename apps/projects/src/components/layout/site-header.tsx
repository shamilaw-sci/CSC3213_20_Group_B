import { ThemeToggle } from '@scs/ui/components/theme-toggle';
import Image from 'next/image';
import Link from 'next/link';

export function SiteHeader() {
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

        <ThemeToggle />
      </div>
    </header>
  );
}
