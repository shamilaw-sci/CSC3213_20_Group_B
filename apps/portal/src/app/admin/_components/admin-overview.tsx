import { FolderKanban, GraduationCap, Network, Users } from 'lucide-react';
import Link from 'next/link';

import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';

const sections = [
  {
    title: 'Users',
    href: '/admin/users',
    description: 'Manage user accounts, roles, and account status.',
    icon: Users,
  },
  {
    title: 'Proxies',
    href: '/admin/proxies',
    description:
      'Review proxy records, reset attempts, and generate the manifest.',
    icon: Network,
  },
  {
    title: 'Projects',
    href: '/admin/projects',
    description: 'Create, edit, archive, and remove public project records.',
    icon: FolderKanban,
  },
  {
    title: 'Academic Rules',
    href: '/admin/academic-rules',
    description: 'Manage trusted undergraduate, alumni, and SLQF mappings.',
    icon: GraduationCap,
  },
] as const;

export default function AdminOverview() {
  return (
    <PageShell>
      <BackButton
        fallbackHref="/dashboard"
        label="Back to Dashboard"
        preferFallback
      />
      <PageHeader
        title="Admin"
        description="Admin tools for accounts, access, and proxy configuration."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group flex min-h-32 items-start gap-4 rounded-md border bg-card p-5 text-card-foreground shadow-sm transition-colors hover:border-foreground/25 hover:bg-muted/30"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-background">
                <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="font-semibold">{section.title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {section.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
