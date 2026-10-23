import type { ReactNode } from 'react';

interface CourseCodesSectionProps {
  children: ReactNode;
}

export function CourseCodesSection({ children }: CourseCodesSectionProps) {
  return (
    <section
      id="course-codes"
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div>
        <h3 className="text-base font-semibold">Codes</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose the primary course code and any equivalent catalog codes.
        </p>
      </div>
      {children}
    </section>
  );
}
