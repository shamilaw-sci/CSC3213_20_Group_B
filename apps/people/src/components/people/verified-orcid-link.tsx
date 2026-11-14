'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@scs/ui/components/tooltip';
import { BadgeCheck } from 'lucide-react';
import { SiOrcid } from 'react-icons/si';

function VerifiedTooltipContent() {
  return (
    <TooltipContent>
      <span className="inline-flex items-center gap-1">
        <BadgeCheck
          className="text-info-surface-foreground size-4"
          aria-hidden="true"
        />
        Verified
      </span>
    </TooltipContent>
  );
}

export function VerifiedOrcidLink({
  href,
  compact = false,
}: {
  href: string;
  compact?: boolean;
}) {
  if (compact)
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ORCID"
              className="bg-card text-muted-foreground hover:border-primary
                hover:bg-primary hover:text-primary-foreground inline-flex
                size-10 items-center justify-center rounded-md border
                transition-colors"
            >
              <SiOrcid className="size-5" aria-hidden="true" />
            </a>
          }
        />
        <VerifiedTooltipContent />
      </Tooltip>
    );

  return (
    <div className="bg-card flex min-h-10 items-center rounded-md border">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-primary focus-visible:ring-ring inline-flex
          min-h-10 min-w-0 flex-1 items-center gap-2 px-3 text-sm
          focus-visible:ring-2 focus-visible:outline-none"
      >
        <SiOrcid className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">ORCID</span>
      </a>
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label="Verified"
          className="text-info-surface-foreground focus-visible:ring-ring
            inline-flex size-10 shrink-0 items-center justify-center rounded-sm
            focus-visible:ring-2 focus-visible:outline-none"
        >
          <BadgeCheck className="size-4" aria-hidden="true" />
        </TooltipTrigger>
        <VerifiedTooltipContent />
      </Tooltip>
    </div>
  );
}
