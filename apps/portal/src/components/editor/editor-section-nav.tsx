'use client';

export interface EditorSection {
  id: string;
  label: string;
}

interface EditorSectionNavProps {
  sections: readonly EditorSection[];
}

export function EditorSectionNav({ sections }: EditorSectionNavProps) {
  const focusSection = (id: string) => {
    const section = document.getElementById(id);
    section?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    section?.focus({ preventScroll: true });
  };

  return (
    <nav aria-label="Editor sections" className="lg:sticky lg:top-20">
      <p
        className="text-muted-foreground mb-2 text-xs font-semibold
          tracking-wide uppercase"
      >
        Sections
      </p>
      <ul className="space-y-1">
        {sections.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              className="text-muted-foreground hover:border-border
                hover:bg-muted hover:text-foreground flex min-h-10 w-full
                items-center rounded-md border-l-2 border-transparent px-3
                text-left text-sm focus-visible:outline-none"
              onClick={() => focusSection(section.id)}
            >
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
