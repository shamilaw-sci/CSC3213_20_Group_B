import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { VerifiedOrcidLink } from '@/components/people/verified-orcid-link';

test('Links tab keeps a full ORCID link with a separate verification mark', () => {
  const markup = renderToStaticMarkup(
    <VerifiedOrcidLink href="https://orcid.org/0000-0002-1825-0097" />
  );
  expect(markup).toContain('href="https://orcid.org/0000-0002-1825-0097"');
  expect(markup).toContain('>ORCID</span>');
  expect(markup).toContain('aria-label="Verified"');
  expect(markup).toContain('text-info-surface-foreground');
  expect(markup).not.toContain('hover:bg-info-surface');
  expect(markup).not.toContain('hover:border-primary');
  expect(markup).toMatch(/<\/a><button[^>]+aria-label="Verified"/);
});

test('the compact row shows only the ORCID icon with verification in its tooltip', () => {
  const markup = renderToStaticMarkup(
    <VerifiedOrcidLink href="https://orcid.org/0000-0002-1825-0097" compact />
  );
  expect(markup).toContain('href="https://orcid.org/0000-0002-1825-0097"');
  expect(markup).toContain('aria-label="ORCID"');
  expect(markup).not.toContain('>ORCID</span>');
  expect(markup).not.toContain('aria-label="Verified"');
  expect(markup).not.toContain('<button');
});
