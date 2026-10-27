import {
  ArrowRight,
  BookOpen,
  Braces,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';

const destinations = [
  {
    href: '/docs',
    title: 'Start here',
    description:
      'Understand the repository, its workspaces, and daily commands.',
    icon: BookOpen,
  },
  {
    href: '/docs/architecture',
    title: 'Architecture',
    description: 'Follow ownership, trust boundaries, data flows, and state.',
    icon: Braces,
  },
  {
    href: '/docs/development',
    title: 'Development',
    description: 'Set up the monorepo and use its verification workflow.',
    icon: Wrench,
  },
  {
    href: '/docs/security',
    title: 'Security',
    description: 'Review authentication, authorization, and secret boundaries.',
    icon: ShieldCheck,
  },
] as const;

export function DocsHome() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-16
        sm:py-24"
    >
      <div className="max-w-3xl">
        <p
          className="text-fd-muted-foreground text-sm font-medium tracking-wide
            uppercase"
        >
          SCS PDN engineering
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          One handbook for the whole system.
        </h1>
        <p className="text-fd-muted-foreground mt-6 text-lg/8">
          Architecture, contracts, development, deployment, and maintenance for
          every application, service, and shared package in the monorepo.
        </p>
      </div>

      <section
        aria-labelledby="explore-documentation"
        className="mt-14 grid gap-4 sm:grid-cols-2"
      >
        <h2 id="explore-documentation" className="sr-only">
          Explore documentation
        </h2>
        {destinations.map(({ description, href, icon: Icon, title }) => (
          <Link
            key={href}
            href={href}
            className="border-fd-border bg-fd-card hover:bg-fd-accent
              focus-visible:ring-fd-ring group rounded-2xl border p-6
              transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex items-start justify-between gap-4">
              <Icon aria-hidden="true" className="text-fd-primary size-5" />
              <ArrowRight
                aria-hidden="true"
                className="text-fd-muted-foreground
                  group-hover:text-fd-foreground size-4 transition-colors"
              />
            </div>
            <h3 className="mt-8 text-lg font-semibold">{title}</h3>
            <p className="text-fd-muted-foreground mt-2 text-sm/6">
              {description}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
