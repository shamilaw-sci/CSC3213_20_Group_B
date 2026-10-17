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

export default function PeopleSearch() {
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
    <div className="relative min-w-0 flex-1 md:max-w-sm">
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="text"
          role="searchbox"
          value={query}
          placeholder="Search people"
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
          className="h-9 w-full rounded-md border bg-background pl-8 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
        {isLoading ? (
          <Loader2
            className="text-muted-foreground absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin"
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
            className="text-muted-foreground hover:text-foreground absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-md border bg-card shadow-lg">
          {error ? (
            <p className="text-muted-foreground px-3 py-3 text-sm">
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
                  className="block px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <span className="block truncate font-medium text-card-foreground">
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
            <p className="text-muted-foreground px-3 py-3 text-sm">
              No people found.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
