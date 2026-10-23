import type { ReactNode } from 'react';

interface ProfileLinksSectionProps {
  children: ReactNode;
}

export function ProfileLinksSection({ children }: ProfileLinksSectionProps) {
  return (
    <section
      id="profile-links"
      tabIndex={-1}
      className="scroll-mt-24 space-y-4 outline-none"
    >
      <div>
        <h3 className="text-base font-semibold">Links</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect public professional and social profiles using recognizable
          labels.
        </p>
      </div>
      {children}
    </section>
  );
}
