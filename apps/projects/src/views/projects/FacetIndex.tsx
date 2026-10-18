'use client';

import { Badge } from '@scs/ui/components/badge';
import { Card, CardContent, CardTitle } from '@scs/ui/components/card';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  ProjectErrorPanel,
  StatePanel,
  TileGridLoading,
} from '@/components/custom/StatePanel';
import {
  fetchCategories,
  fetchTags,
  type ProjectFacet,
} from '@/lib/projects/api-client';

import { PageIntro } from './RegistryUI';

type FacetItem = {
  href: string;
  label: string;
  count: number;
  description?: string;
};

export default function FacetIndex({
  eyebrow,
  title,
  description,
  kind,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  kind: 'categories' | 'tags';
}>) {
  const [items, setItems] = useState<FacetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    function toItems(facets: ProjectFacet[]) {
      return facets.map((facet) => ({
        href:
          kind === 'categories'
            ? `/categories/${facet.slug}`
            : `/topics/${facet.slug}`,
        label: facet.label,
        count: facet.count,
      }));
    }

    async function loadItems() {
      try {
        const facets =
          kind === 'categories'
            ? await fetchCategories(controller.signal)
            : await fetchTags(controller.signal);

        setItems(toItems(facets));
        setLoadFailed(false);
      } catch {
        if (!controller.signal.aborted) {
          setItems([]);
          setLoadFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadItems();

    return () => {
      controller.abort();
    };
  }, [kind, reloadKey]);

  return (
    <>
      <PageIntro eyebrow={eyebrow} title={title} description={description} />
      <section className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4 px-4 py-10">
        {loading ? (
          <TileGridLoading
            className="col-span-full"
            label={`Loading ${kind}`}
          />
        ) : null}
        {!loading && loadFailed ? (
          <ProjectErrorPanel
            title={`${kind === 'categories' ? 'Categories' : 'Tags'} could not be loaded`}
            description="The published project registry is not available right now."
            onRetry={() => setReloadKey((key) => key + 1)}
            className="col-span-full"
          />
        ) : null}
        {!loading && !loadFailed && items.length === 0 ? (
          <StatePanel
            title={`No ${kind} yet`}
            description="There are no published project facets in this section yet."
            action={{ href: '/search', label: 'Search projects' }}
            secondaryAction={{ href: '/', label: 'Go home' }}
            className="col-span-full"
          />
        ) : null}
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group block min-w-0"
          >
            <Card className="h-full min-w-0 rounded-md p-5 transition group-hover:-translate-y-0.5 group-hover:bg-muted/35 group-hover:shadow-lg">
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <CardTitle className="min-w-0 text-lg leading-snug [overflow-wrap:anywhere]">
                  {item.label}
                </CardTitle>
                <Badge className="shrink-0 rounded-md">{item.count}</Badge>
              </div>
              {item.description ? (
                <CardContent className="px-0">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              ) : null}
            </Card>
          </Link>
        ))}
      </section>
    </>
  );
}
