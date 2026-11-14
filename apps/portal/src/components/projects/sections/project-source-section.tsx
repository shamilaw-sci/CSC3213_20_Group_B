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
        <h3 className="text-base font-semibold">GitHub project details</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          A linked public GitHub project can provide some display details from
          .docs/index.json. The project link name stays here. After changing
          linked people, update public data so their profiles show the project.
        </p>
      </div>
      {children}
    </section>
  );
}
