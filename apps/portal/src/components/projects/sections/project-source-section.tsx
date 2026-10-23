import type { ReactNode } from 'react';

interface ProjectSourceSectionProps {
  children: ReactNode;
}

export function ProjectSourceSection({ children }: ProjectSourceSectionProps) {
  return (
    <section
      id="project-source"
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div>
        <h3 className="text-base font-semibold">Source</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Administrative provenance and display metadata for the public
          registry.
        </p>
      </div>
      {children}
    </section>
  );
}
