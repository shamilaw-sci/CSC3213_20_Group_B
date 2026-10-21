import { Button } from '@scs/ui/components/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface PaginationProps {
  previousHref?: string;
  nextHref?: string;
}

export function Pagination({ previousHref, nextHref }: PaginationProps) {
  if (!previousHref && !nextHref) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-2"
    >
      {previousHref ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={previousHref} aria-label="Go to previous page">
            <ChevronLeft data-icon="inline-start" />
            Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft data-icon="inline-start" />
          Previous
        </Button>
      )}
      {nextHref ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={nextHref} aria-label="Go to next page">
            Next
            <ChevronRight data-icon="inline-end" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Next
          <ChevronRight data-icon="inline-end" />
        </Button>
      )}
    </nav>
  );
}
