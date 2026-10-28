import { ViewOptionsPopover } from 'fumadocs-ui/layouts/docs/page';

import { siteConfig } from '@/config/site.config';

type RepositoryViewOptionsProps = {
  markdownUrl: string;
  pageUrl: string;
  sourcePath: string;
};

export function RepositoryViewOptions({
  markdownUrl,
  pageUrl,
  sourcePath,
}: RepositoryViewOptionsProps) {
  const encodedPath = sourcePath
    .replaceAll('\\', '/')
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  return (
    <ViewOptionsPopover
      markdownUrl={markdownUrl}
      pageUrl={pageUrl}
      githubUrl={`${siteConfig.repositoryUrl}/blob/main/docs/${encodedPath}`}
    />
  );
}
