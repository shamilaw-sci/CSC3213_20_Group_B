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
        <p className="mt-1 text-sm text-muted-foreground">
          Set the stable catalog identity, title, and credit value.
        </p>
      </div>
      {children}
    </section>
  );
}
