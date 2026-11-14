'use client';

import { Button } from '@scs/ui/components/button';
import { Input } from '@scs/ui/components/input';
import { Label } from '@scs/ui/components/label';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { SyntheticEvent } from 'react';

import {
  buildCollectionPath,
  canonicalizeSearchSegment,
} from '@/lib/projects/collection-navigation';

export function ProjectSearchForm({
  defaultValue = '',
}: Readonly<{ defaultValue?: string }>) {
  const router = useRouter();

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, Event>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = canonicalizeSearchSegment(
      String(formData.get('query') ?? '')
    );

    router.push(
      query
        ? buildCollectionPath({ kind: 'search', query })
        : buildCollectionPath({ kind: 'browse' })
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <Label htmlFor="project-directory-search">Search projects</Label>
      <div className="mt-2 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute
              top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            id="project-directory-search"
            name="query"
            defaultValue={defaultValue}
            placeholder="Title, course, person, or technology"
            autoComplete="off"
            className="h-11 pl-10"
          />
        </div>
        <Button type="submit" className="h-11">
          Search
        </Button>
      </div>
    </form>
  );
}
