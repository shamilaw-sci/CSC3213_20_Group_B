'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@scs/ui/components/tooltip';
import { BadgeCheck } from 'lucide-react';
import { SiOrcid } from 'react-icons/si';

export function VerifiedOrcidLink({ href }: { href: string }) {
  return (
    <div className="bg-card flex w-fit items-center rounded-md border">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="ORCID"
        className="hover:text-primary focus-visible:ring-ring inline-flex
          size-10 items-center justify-center rounded-sm focus-visible:ring-2
          focus-visible:outline-none"
      >
        <SiOrcid className="size-5" aria-hidden="true" />
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
        <TooltipContent>
          <span className="inline-flex items-center gap-1">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Verified
          </span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
