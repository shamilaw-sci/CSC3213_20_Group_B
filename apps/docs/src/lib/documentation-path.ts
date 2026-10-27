const MARKDOWN_EXTENSION = /\.mdx?$/i;
const WEB_PROTOCOL = /^[a-z][a-z0-9+.-]*:/i;

function toKebabCase(segment: string): string {
  return segment
    .replace(MARKDOWN_EXTENSION, '')
    .replaceAll('_', '-')
    .toLowerCase();
}

export function toDocumentationSlugs(path: string): string[] {
  const segments = path
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .split('/')
    .filter(Boolean)
    .map(toKebabCase);

  if (segments.at(-1) === 'index') segments.pop();
  return segments;
}

export function toDocumentationUrl(path: string): string {
  const slugs = toDocumentationSlugs(path);
  return slugs.length === 0 ? '/docs' : `/docs/${slugs.join('/')}`;
}

function resolveDocumentationPath(path: string, sourcePath?: string): string {
  const segments = sourcePath
    ? sourcePath.replaceAll('\\', '/').split('/').slice(0, -1)
    : [];

  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.join('/');
}

export function rewriteDocumentationHref(
  href: string,
  sourcePath?: string
): string {
  if (href.startsWith('#') || href.startsWith('/') || WEB_PROTOCOL.test(href)) {
    return href;
  }

  const [path, fragment] = href.split('#', 2);
  if (!MARKDOWN_EXTENSION.test(path)) return href;

  const url = toDocumentationUrl(resolveDocumentationPath(path, sourcePath));
  return fragment ? `${url}#${fragment}` : url;
}
