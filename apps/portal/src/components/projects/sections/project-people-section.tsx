import type { ReactNode } from 'react';

interface ProjectPeopleSectionProps {
  children: ReactNode;
}

export function ProjectPeopleSection({ children }: ProjectPeopleSectionProps) {
  return (
    <section
      id="project-people"
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div>
        <h3 className="text-base font-semibold">People</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Add the people responsible for this project and describe each role.
        </p>
      </div>
      {children}
    </section>
  );
}
