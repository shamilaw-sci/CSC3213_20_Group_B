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
        <h3 className="text-base font-semibold">Repository metadata</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          For a public GitHub repository, the project page reads selected
          display details from its root .docs/index.json. Project ID and slug
          stay in the registry. Run the data sync to update person indexes.
        </p>
      </div>
      {children}
    </section>
  );
}
