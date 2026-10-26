import { Button } from '@scs/ui/components/button';
import { ArrowRight } from 'lucide-react';

import { AppLink } from '@/components/navigation/app-link';

interface PageIntroProps {
  action?: {
    href: string;
    label: string;
  };
  description: string;
  eyebrow: string;
  title: string;
}

export function PageIntro({
  action,
  description,
  eyebrow,
  title,
}: PageIntroProps) {
  return (
    <section
      className="bg-muted/45 grid overflow-hidden border-y
        lg:grid-cols-[1.05fr_0.95fr]"
    >
      <div className="px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <p
          className="text-primary border-l-primary border-l-2 pl-3 text-xs
            font-semibold tracking-[0.2em] uppercase"
        >
          {eyebrow}
        </p>
        <h1
          className="mt-5 max-w-3xl font-serif text-4xl leading-[1.05]
            font-semibold tracking-tight sm:text-5xl lg:text-6xl"
        >
          {title}
        </h1>
        <p
          className="text-muted-foreground mt-6 max-w-2xl text-base/7
            sm:text-lg/8"
        >
          {description}
        </p>
        {action ? (
          <Button asChild size="lg" className="mt-8">
            <AppLink
              href={action.href}
              destination={
                action.href.startsWith('http') ? 'external-product' : 'local'
              }
            >
              {action.label}
              <ArrowRight aria-hidden="true" className="size-4" />
            </AppLink>
          </Button>
        ) : null}
      </div>
      <div
        className="bg-primary text-primary-foreground flex min-h-64 flex-col
          justify-end p-6 sm:p-8 lg:min-h-full lg:p-12"
      >
        <p
          className="text-primary-foreground/75 text-xs font-semibold
            tracking-[0.2em] uppercase"
        >
          Since 1996
        </p>
        <p
          className="mt-3 max-w-lg font-serif text-2xl/8 font-semibold
            sm:text-3xl/10"
        >
          Education, research, and community outreach in Computer Science and
          Statistics.
        </p>
      </div>
    </section>
  );
}
