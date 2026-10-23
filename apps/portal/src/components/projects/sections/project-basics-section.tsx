import type { ReactNode } from 'react';

interface ProjectBasicsSectionProps {
  children: ReactNode;
}

export function ProjectBasicsSection({ children }: ProjectBasicsSectionProps) {
  return (
    <section
      id="project-title"
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div>
        <h3 className="text-base font-semibold">Basics</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Give the project a clear identity and a short public explanation.
        </p>
      </div>
      {children}
    </section>
  );
}
