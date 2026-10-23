const institutionalLinks = [
  {
    href: 'https://scs-pdn.space',
    label: 'Department of Statistics & Computer Science',
  },
  { href: 'https://sci.pdn.ac.lk', label: 'Faculty of Science' },
  { href: 'https://www.pdn.ac.lk', label: 'University of Peradeniya' },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-muted/45 border-t">
      <div
        className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-2
          px-4 py-7 text-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <p>People directory · University of Peradeniya</p>
        <nav
          aria-label="Institutional links"
          className="flex flex-wrap gap-x-4"
        >
          {institutionalLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground inline-flex min-h-9 items-center
                underline-offset-4 hover:underline focus-visible:rounded-sm
                focus-visible:outline-none"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
