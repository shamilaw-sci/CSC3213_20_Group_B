import Link from 'next/link';

const discoveryLinks = [
  { href: '/search', label: 'Search projects' },
  { href: '/find-by', label: 'Find by person' },
  { href: '/courses', label: 'Browse courses' },
  { href: '/categories', label: 'Browse categories' },
  { href: '/topics', label: 'Browse topics' },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-muted/45 border-t">
      <div
        className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:flex-row
          sm:items-end sm:justify-between"
      >
        <div>
          <p className="font-semibold">SCS Projects</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Student, research, and departmental work from the University of
            Peradeniya.
          </p>
        </div>
        <nav
          aria-label="Project discovery links"
          className="flex max-w-xl flex-wrap gap-x-4"
        >
          {discoveryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground inline-flex
                min-h-9 items-center text-sm underline-offset-4 hover:underline
                focus-visible:rounded-sm focus-visible:outline-none"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
