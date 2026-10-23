import type { ReactNode } from 'react';

interface ProjectLinksSectionProps {
  children: ReactNode;
}

export function ProjectLinksSection({ children }: ProjectLinksSectionProps) {
  return (
    <section
      id="project-links"
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div>
        <h3 className="text-base font-semibold">Links</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Add only the public destinations that help visitors understand the
          project.
        </p>
      </div>
      {children}
    </section>
  );
}
