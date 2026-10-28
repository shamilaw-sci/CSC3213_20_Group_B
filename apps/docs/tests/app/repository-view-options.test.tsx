import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { RepositoryViewOptions } from '@/components/repository/repository-view-options';

vi.mock('fumadocs-ui/layouts/docs/page', () => ({
  ViewOptionsPopover: ({ githubUrl }: { githubUrl: string }) => (
    <a href={githubUrl}>Edit source</a>
  ),
}));

describe('documentation page actions', () => {
  test('links source to the main repository', () => {
    render(
      <RepositoryViewOptions
        markdownUrl="/llms.mdx/docs/development/content.md"
        pageUrl="https://docs.scs-pdn.space/docs/development"
        sourcePath="DEVELOPMENT.md"
      />
    );

    expect(screen.getByRole('link', { name: 'Edit source' })).toHaveAttribute(
      'href',
      'https://github.com/csc3213-2026-group-b/scs-pdn-monorepo/blob/main/docs/DEVELOPMENT.md'
    );
  });
});
