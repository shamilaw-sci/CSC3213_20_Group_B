import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { VerifiedOrcidLink } from '@/components/people/verified-orcid-link';

test.each([false, true])(
  'verified ORCID link uses the simple label and a separate accessible mark (compact=%s)',
  (compact) => {
    const markup = renderToStaticMarkup(
      <VerifiedOrcidLink
        href="https://orcid.org/0000-0002-1825-0097"
        compact={compact}
      />
    );
    expect(markup).toContain('href="https://orcid.org/0000-0002-1825-0097"');
    expect(markup).toContain('>ORCID</span>');
    expect(markup).not.toContain('Verified ORCID 0000-0002-1825-0097');
    expect(markup).toContain('ORCID identity verified through ORCID');
    expect(markup).toContain('text-info-surface-foreground');
    expect(markup).toMatch(
      /<\/a><button[^>]+aria-label="ORCID identity verified through ORCID"/
    );
  }
);
