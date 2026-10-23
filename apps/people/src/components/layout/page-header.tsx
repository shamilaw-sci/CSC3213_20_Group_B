import Link from 'next/link';

export interface BreadcrumbItem {
  href?: string;
  label: string;
}

interface PageHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  eyebrow?: string;
  title: string;
  description?: string;
}

export default function PageHeader({
  breadcrumbs,
  eyebrow,
  title,
  description,
}: PageHeaderProps) {
  return (
    <header className="mb-6 border-b pb-5">
      <nav
        className="text-muted-foreground mb-4 flex flex-wrap items-center gap-2
          text-sm"
      >
        {breadcrumbs.map((item, index) => (
          <span
            key={`${item.label}-${index}`}
            className="flex items-center gap-2"
          >
            {index > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-primary transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground">{item.label}</span>
            )}
          </span>
        ))}
      </nav>
      {eyebrow && (
        <p className="text-primary mb-2 text-sm font-semibold">{eyebrow}</p>
      )}
      <h1 className="text-card-foreground text-3xl font-semibold">{title}</h1>
      {description && (
        <p className="text-muted-foreground mt-1">{description}</p>
      )}
    </header>
  );
}
