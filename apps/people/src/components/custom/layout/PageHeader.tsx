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
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {breadcrumbs.map((item, index) => (
          <span
            key={`${item.label}-${index}`}
            className="flex items-center gap-2"
          >
            {index > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-primary"
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
        <p className="mb-2 text-sm font-semibold text-primary">{eyebrow}</p>
      )}
      <h1 className="text-3xl font-semibold text-card-foreground">{title}</h1>
      {description && (
        <p className="mt-1 text-muted-foreground">{description}</p>
      )}
    </header>
  );
}
