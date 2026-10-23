import type { ReactNode } from 'react';

interface ProfileAboutSectionProps {
  children: ReactNode;
}

export function ProfileAboutSection({ children }: ProfileAboutSectionProps) {
  return (
    <section
      id="profile-about"
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div>
        <h3 className="text-base font-semibold">About you</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          The name, contact information, and image shown in the public
          directory.
        </p>
      </div>
      {children}
    </section>
  );
}
