import Link from 'next/link';

const academicLinks = [
  { href: '/undergraduate-courses', label: 'Undergraduate courses' },
  { href: '/postgraduate-courses', label: 'Postgraduate courses' },
  { href: '/prizes-scholarships', label: 'Prizes & scholarships' },
] as const;

const departmentLinks = [
  { href: '/research', label: 'Research' },
  { href: '/services', label: 'Services' },
  { href: '/societies', label: 'Societies' },
  { href: '/resources', label: 'Resources' },
] as const;

const relatedLinks = [
  { href: '/people', label: 'People directory' },
  { href: '/e-learning', label: 'E-learning' },
  { href: '/contact', label: 'Contact' },
] as const;

const footerLinkClass =
  'inline-flex min-h-9 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none';

export function SiteFooter() {
  return (
    <footer className="bg-muted/45 border-t">
      <div
        className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6
          md:grid-cols-2 lg:grid-cols-4 lg:px-8"
      >
        <div>
          <p className="font-semibold">
            Department of Statistics &amp; Computer Science
          </p>
          <p className="text-muted-foreground mt-3 max-w-xs text-sm leading-6">
            Faculty of Science, University of Peradeniya, Sri Lanka.
          </p>
        </div>
        <FooterGroup title="Study" links={academicLinks} />
        <FooterGroup title="Department" links={departmentLinks} />
        <FooterGroup title="Connect" links={relatedLinks} />
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

interface FooterGroupProps {
  links: ReadonlyArray<{ href: string; label: string }>;
  title: string;
}

function FooterGroup({ links, title }: FooterGroupProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link className={footerLinkClass} href={link.href}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
