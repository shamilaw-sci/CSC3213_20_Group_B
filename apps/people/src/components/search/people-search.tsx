'use client';

import { Loader2, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';

import {
  getPeopleSearchIndex,
  type PeopleSearchEntry,
  prefetchPeopleSearchIndex,
} from '@/lib/data/people-data';

function matchesEntry(entry: PeopleSearchEntry, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return false;

  return entry.keywords.some((keyword) =>
    keyword.toLowerCase().includes(normalizedQuery)
  );
}

export function PeopleSearch() {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<PeopleSearchEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const loadedRef = useRef(false);

  async function loadIndex() {
    if (loadedRef.current || isLoading) return;

    setIsLoading(true);
    setError(false);
    try {
      setEntries(await getPeopleSearchIndex());
      loadedRef.current = true;
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }

  const results = useMemo(
    () => entries.filter((entry) => matchesEntry(entry, query)).slice(0, 8),
    [entries, query]
  );
  const showPanel = isOpen && (query.trim() || isLoading || error);

  return (
    <div className="relative min-w-0 flex-1 md:max-w-md">
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2
            left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="search"
          role="searchbox"
          value={query}
          placeholder="Search by name, role, or email"
          aria-label="Search people"
          onFocus={() => {
            setIsOpen(true);
            prefetchPeopleSearchIndex();
            void loadIndex();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            void loadIndex();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
          }}
          className="bg-background placeholder:text-muted-foreground
            focus-visible:border-ring focus-visible:ring-ring/30 h-10 w-full
            rounded-md border px-9 text-sm transition-colors outline-none
            focus-visible:ring-2"
        />
        {isLoading ? (
          <Loader2
            className="text-muted-foreground absolute top-1/2 right-3 size-4
              -translate-y-1/2 animate-spin"
            aria-hidden="true"
          />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            aria-label="Clear people search"
            className="text-muted-foreground hover:text-foreground absolute
              top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center
              justify-center rounded-md"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div
          className="bg-popover text-popover-foreground absolute inset-x-0
            top-full z-50 mt-2 overflow-hidden rounded-md border shadow-lg"
        >
          {error ? (
            <p className="text-muted-foreground p-3 text-sm">
              Unable to load people search.
            </p>
          ) : results.length > 0 ? (
            <div className="max-h-80 overflow-y-auto py-1">
              {results.map((entry) => (
                <Link
                  key={entry.id}
                  href={entry.href}
                  onClick={() => {
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="hover:bg-muted focus-visible:bg-muted block px-3
                    py-2 text-sm transition-colors focus-visible:outline-none"
                >
                  <span className="block truncate font-medium">
                    {entry.name}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {[entry.subtitle, entry.email ?? entry.identity]
                      .filter(Boolean)
                      .join(' / ')}
                  </span>
                </Link>
              ))}
            </div>
          ) : query.trim() && !isLoading ? (
            <p className="text-muted-foreground p-3 text-sm">
              No people found.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
