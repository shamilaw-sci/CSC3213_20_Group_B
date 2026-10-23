import type { ReactNode } from 'react';

interface CourseDetailsSectionProps {
  children: ReactNode;
}

export function CourseDetailsSection({ children }: CourseDetailsSectionProps) {
  return (
    <section
      id="course-details"
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div>
        <h3 className="text-base font-semibold">Details</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Set the stable catalog identity, title, and credit value.
        </p>
      </div>
      {children}
    </section>
  );
}
