import type { ReactNode } from 'react';

interface ProjectAcademicSectionProps {
  children: ReactNode;
}

export function ProjectAcademicSection({
  children,
}: ProjectAcademicSectionProps) {
  return (
    <section
      id="project-academic"
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div>
        <h3 className="text-base font-semibold">Academic context</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Classify the project and connect course projects to an existing
          offering.
        </p>
      </div>
      {children}
    </section>
  );
}
