'use client';

import { useTheme } from 'next-themes';
import { use, useId, useSyncExternalStore } from 'react';

type MermaidProps = {
  chart: string;
};

const renderingCache = new Map<string, Promise<unknown>>();
const subscribeToClient = () => () => undefined;

function cachedPromise<T>(key: string, create: () => Promise<T>): Promise<T> {
  const cached = renderingCache.get(key);
  if (cached) return cached as Promise<T>;

  const promise = create();
  renderingCache.set(key, promise);
  return promise;
}

function MermaidContent({ chart }: MermaidProps) {
  const id = useId();
  const { resolvedTheme } = useTheme();
  const { default: mermaid } = use(
    cachedPromise('mermaid-module', () => import('mermaid'))
  );

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    fontFamily: 'inherit',
    theme: resolvedTheme === 'dark' ? 'dark' : 'default',
  });

  const { bindFunctions, svg } = use(
    cachedPromise(`${chart}-${resolvedTheme}`, () =>
      mermaid.render(id, chart.replaceAll('\\n', '\n'))
    )
  );

  return (
    <div
      className="my-6 overflow-x-auto"
      ref={(container) => {
        if (container) bindFunctions?.(container);
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function Mermaid({ chart }: MermaidProps) {
  const isClient = useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false
  );
  if (!isClient) return null;

  return <MermaidContent chart={chart} />;
}
