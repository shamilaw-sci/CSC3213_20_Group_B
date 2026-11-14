'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@scs/ui/components/tooltip';
import { cn } from 'cn';
import { BadgeCheck } from 'lucide-react';
import { SiOrcid } from 'react-icons/si';

export function VerifiedOrcidLink({
  href,
  compact = false,
}: {
  href: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        `bg-card hover:border-primary flex items-center rounded-md border
        transition-colors`,
        compact ? 'gap-1 px-2' : 'min-h-10 gap-1 px-2'
      )}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'hover:text-primary inline-flex min-w-0 items-center gap-2 text-sm',
          compact ? 'min-h-10' : 'min-h-10 flex-1'
        )}
      >
        <SiOrcid
          className={cn('shrink-0', compact ? 'size-5' : 'size-4')}
          aria-hidden="true"
        />
        <span className="truncate">ORCID</span>
      </a>
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label="ORCID identity verified through ORCID"
          className="text-info-surface-foreground hover:bg-info-surface
            focus-visible:ring-ring inline-flex size-10 shrink-0 items-center
            justify-center rounded-sm focus-visible:ring-2
            focus-visible:outline-none"
        >
          <BadgeCheck className="size-4" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Verified ORCID</p>
          <p className="mt-1">
            This ORCID iD was authenticated through ORCID and linked to the
            researcher&apos;s SCS-PDN account.
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
