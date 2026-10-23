import type { ReactNode } from 'react';

interface ProfileRoleSectionProps {
  children: ReactNode;
}

export function ProfileRoleSection({ children }: ProfileRoleSectionProps) {
  return (
    <section
      id="profile-role"
      tabIndex={-1}
      className="scroll-mt-24 space-y-6 outline-none"
    >
      <div>
        <h3 className="text-base font-semibold">Role and affiliation</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Describe the university role, programme, department, or student
          placement.
        </p>
      </div>
      {children}
    </section>
  );
}
