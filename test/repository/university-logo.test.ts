import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const applications = ['docs', 'people', 'portal', 'projects', 'web'] as const;
const logos = applications.map((application) =>
  readFileSync(
    `apps/${application}/public/favicon/logo-symbol-icon.svg`,
    'utf8'
  )
);

describe('University of Peradeniya logo', () => {
  test('ships one lossless optimized vector across every application', () => {
    for (const logo of logos) expect(logo).toBe(logos[0]);

    const logo = logos[0];
    expect(logo).toContain('viewBox="120 70 760 760"');
    expect(logo).toContain('shape-rendering="geometricPrecision"');
    expect(logo.match(/<path\b/gu)?.length).toBeLessThanOrEqual(70);
  });

  test('contains no raster fallback or avoidable rendering effects', () => {
    const logo = logos[0];

    expect(logo).not.toMatch(/<(?:filter|image|metadata|style)\b/u);
    expect(logo).not.toMatch(/\b(?:filter|id|stroke|transform)=/u);
    expect(logo).not.toContain('shape-rendering="crispEdges"');
  });
});
