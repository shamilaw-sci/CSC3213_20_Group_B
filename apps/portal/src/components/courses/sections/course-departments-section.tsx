import type { ReactNode } from 'react';

interface CourseDepartmentsSectionProps {
  children: ReactNode;
}

export function CourseDepartmentsSection({
  children,
}: CourseDepartmentsSectionProps) {
  return (
    <section
      id="course-departments"
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div>
        <h3 className="text-base font-semibold">Departments</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Select every department that owns or contributes to the course.
        </p>
      </div>
      {children}
    </section>
  );
}
