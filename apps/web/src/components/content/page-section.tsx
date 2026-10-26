import type { PropsWithChildren } from 'react';

interface PageSectionProps extends PropsWithChildren {
  eyebrow?: string;
  title: string;
}

export function PageSection({ children, eyebrow, title }: PageSectionProps) {
  return (
    <section className="border-b py-10 last:border-b-0 sm:py-14">
      <div
        className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]
          lg:gap-12"
      >
        <div>
          {eyebrow ? (
            <p
              className="text-primary text-xs font-semibold tracking-[0.18em]
                uppercase"
            >
              {eyebrow}
            </p>
          ) : null}
          <h2
            className="mt-3 max-w-xl font-serif text-3xl/10 font-semibold
              tracking-tight sm:text-4xl/11"
          >
            {title}
          </h2>
        </div>
        <div
          className="text-muted-foreground [&_a]:text-primary max-w-3xl
            space-y-5 text-base/7 [&_a]:font-medium [&_a]:underline-offset-4
            [&_a:hover]:underline [&_li]:pl-1 [&_ul]:ml-5 [&_ul]:list-disc
            [&_ul]:space-y-2"
        >
          {children}
        </div>
      </div>
    </section>
  );
}
