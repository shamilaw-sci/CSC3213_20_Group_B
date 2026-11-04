'use client';

import { useEffect, useRef, useState } from 'react';

type MermaidProps = {
  chart: string;
};

function diagramLabel(chart: string): string {
  const title = chart.match(/^\s*accTitle\s*:\s*(.+)$/im)?.[1];
  if (title) return title.trim();

  const type = chart.match(
    /^\s*(flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram(?:-v2)?)\b/im
  )?.[1];
  return `${type ?? 'Mermaid'} diagram`;
}

export function Mermaid({ chart }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failedChart, setFailedChart] = useState<string | null>(null);
  const source = chart.replaceAll('\\n', '\n');
  const failed = failedChart === chart;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let mounted: { destroy: () => void } | undefined;

    void import('pele/lazy')
      .then(async ({ detectType, load, mount }) => {
        if (cancelled) return;
        await load(detectType(source));
        // Loading can finish after navigation or a Strict Mode cleanup.
        if (cancelled) return;
        mounted = mount(container, source, {
          onError: () => {
            if (!cancelled) setFailedChart(chart);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailedChart(chart);
      });

    return () => {
      cancelled = true;
      mounted?.destroy();
    };
  }, [chart, source]);

  return (
    <div
      className="my-6 min-w-0"
      role="group"
      aria-label={diagramLabel(source)}
    >
      <div
        ref={containerRef}
        data-pele
        className={failed ? 'hidden' : undefined}
      />
      {failed && (
        <div role="status" className="rounded-md border p-4">
          <p>Diagram could not be rendered. Mermaid source:</p>
          <pre className="overflow-x-auto text-sm">{source}</pre>
        </div>
      )}
    </div>
  );
}
