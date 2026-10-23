import type { ReactNode } from 'react';

interface CourseOfferingsSectionProps {
  children: ReactNode;
}

export function CourseOfferingsSection({
  children,
}: CourseOfferingsSectionProps) {
  return (
    <section
      id="course-offerings"
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div>
        <h2 className="text-lg font-semibold">Offerings</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage year and semester instances without changing the course draft.
        </p>
      </div>
      {children}
    </section>
  );
}
