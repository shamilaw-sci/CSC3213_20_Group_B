import {
  FolderKanban,
  GraduationCap,
  Images,
  Network,
  Users,
} from 'lucide-react';
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
    title: 'Role Mappings',
    href: '/admin/identity/mappings',
    description: 'Classify verified accounts and inspect decision history.',
    icon: Users,
  },
  {
    title: 'Identity Review',
    href: '/admin/identity/review',
    description: 'Review unclassified university accounts.',
    icon: Users,
  },
  {
    title: 'Avatar Reviews',
    href: '/admin/avatar-reviews',
    description:
      'Approve or reject public pictures that need a manual moderation decision.',
    icon: Images,
  },
  {
    title: 'Personal-Site Redirects',
    href: '/admin/proxies',
    description:
      'Review redirect destinations, reset attempts, and generate the manifest.',
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

export default function AdminOverview({ fullAdmin }: { fullAdmin: boolean }) {
  const visibleSections = fullAdmin
    ? sections
    : [
        {
          title: 'Honours Management',
          href: '/admin/academic-rules/honours',
          description:
            'Review and submit programme assignments in your authorised departments.',
          icon: GraduationCap,
        },
      ];
  return (
    <PageShell>
      <BackButton
        fallbackHref="/dashboard"
        label="Back to Dashboard"
        preferFallback
      />
      <PageHeader
        title="Admin"
        description={
          fullAdmin
            ? 'Admin tools for accounts, access, and proxy configuration.'
            : 'Honours programme management.'
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {visibleSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group bg-card text-card-foreground
                hover:border-foreground/25 hover:bg-muted/30 flex min-h-32
                items-start gap-4 rounded-md border p-5 shadow-sm
                transition-colors"
            >
              <div
                className="bg-background flex size-10 shrink-0 items-center
                  justify-center rounded-md border"
              >
                <Icon
                  className="text-muted-foreground group-hover:text-foreground
                    size-5 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <h2 className="font-semibold">{section.title}</h2>
                <p className="text-muted-foreground text-sm/6">
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
