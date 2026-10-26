import { ArrowUpRight, Mail, Phone } from 'lucide-react';

const institutionalLinks = [
  { href: 'https://sci.pdn.ac.lk', label: 'Faculty of Science' },
  { href: 'https://www.pdn.ac.lk', label: 'University of Peradeniya' },
] as const;

const footerLinkClass =
  'inline-flex min-h-11 items-center gap-1 rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline';

export function SiteFooter() {
  return (
    <footer className="bg-muted/45 border-t">
      <div
        className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6
          md:grid-cols-[minmax(0,1fr)_auto] lg:px-8"
      >
        <div>
          <p className="font-serif text-lg font-semibold">
            Department of Statistics &amp; Computer Science
          </p>
          <p className="text-muted-foreground mt-2 max-w-md text-sm/6">
            Faculty of Science, University of Peradeniya, Peradeniya 20400, Sri
            Lanka.
          </p>
          <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:gap-5">
            <a className={footerLinkClass} href="tel:+94812394251">
              <Phone aria-hidden="true" className="size-4" />
              +94 81 239 4251
            </a>
            <a className={footerLinkClass} href="mailto:headscs@sci.pdn.ac.lk">
              <Mail aria-hidden="true" className="size-4" />
              headscs@sci.pdn.ac.lk
            </a>
          </div>
        </div>
        <nav aria-label="Institutional links" className="flex flex-col">
          {institutionalLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={footerLinkClass}
            >
              {link.label}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          ))}
        </nav>
      </div>
      <div className="border-t">
        <p
          className="text-muted-foreground mx-auto max-w-7xl px-4 py-5 text-xs
            sm:px-6 lg:px-8"
        >
          © {new Date().getFullYear()} University of Peradeniya
        </p>
      </div>
    </footer>
  );
}
