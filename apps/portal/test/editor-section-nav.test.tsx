import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { EditorSectionNav } from '@/components/editor/editor-section-nav';

describe('EditorSectionNav', () => {
  test('stays in normal document flow below the desktop breakpoint', () => {
    const markup = renderToStaticMarkup(
      <EditorSectionNav
        sections={[{ id: 'profile-about', label: 'About you' }]}
      />
    );
    const classNames =
      markup.match(/<nav[^>]*class="([^"]+)"/)?.[1]?.split(' ') ?? [];

    expect(classNames).not.toContain('sticky');
    expect(classNames).not.toContain('top-20');
    expect(classNames).toContain('lg:sticky');
    expect(classNames).toContain('lg:top-20');
  });
});
