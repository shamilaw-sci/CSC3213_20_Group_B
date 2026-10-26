import {
  BarChart3,
  BookOpenText,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

interface Pathway {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
}

const pathways = [
  {
    href: '/undergraduate-courses',
    label: 'Undergraduate programmes',
    description: 'Study Computer Science or Statistics at Peradeniya.',
    icon: GraduationCap,
  },
  {
    href: '/postgraduate-courses',
    label: 'Postgraduate study',
    description: 'Advance through postgraduate teaching and research.',
    icon: BookOpenText,
  },
  {
    href: '/research',
    label: 'Research and innovation',
    description: 'Explore the department’s research areas and activity.',
    icon: BarChart3,
  },
] as const satisfies ReadonlyArray<Pathway>;

export function PathwayLinks() {
  return (
    <section aria-labelledby="pathways-heading" className="border-b">
      <h2 id="pathways-heading" className="sr-only">
        Study and research pathways
      </h2>
      <div className="grid md:grid-cols-3">
        {pathways.map((pathway, index) => {
          const Icon = pathway.icon;
          return (
            <Link
              key={pathway.href}
              href={pathway.href}
              className={`group hover:bg-accent focus-visible:bg-accent flex
              min-h-44 gap-4 px-5 py-7 transition-colors sm:px-7
              ${index > 0 ? 'border-t md:border-t-0 md:border-l' : ''}`}
            >
              <Icon
                aria-hidden="true"
                className="text-primary mt-1 size-7 shrink-0"
              />
              <span>
                <span className="block font-serif text-xl font-semibold">
                  {pathway.label}
                </span>
                <span className="text-muted-foreground mt-2 block text-sm/6">
                  {pathway.description}
                </span>
                <span
                  className="text-primary mt-4 block text-sm font-semibold
                    group-hover:underline"
                >
                  Learn more <span aria-hidden="true">→</span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
