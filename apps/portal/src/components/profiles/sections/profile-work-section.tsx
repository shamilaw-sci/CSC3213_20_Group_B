import type { ReactNode } from 'react';

interface ProfileWorkSectionProps {
  children: ReactNode;
}

export function ProfileWorkSection({ children }: ProfileWorkSectionProps) {
  return (
    <section
      id="profile-work"
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div>
        <h3 className="text-base font-semibold">Work and studies</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Add public qualifications, research, teaching, and projects.
        </p>
      </div>
      {children}
    </section>
  );
}
