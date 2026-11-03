import { type Project, ProjectIndexSchema, ProjectSchema } from '@scs/schemas';

const repoPartPattern = /^[a-z\d][a-z\d._-]*$/i;

/** A failed external source leaves the published registry record usable. */
export async function resolveProjectRepositoryMetadata(
  project: Project
): Promise<Project> {
  const source = project.source;
  if (source.kind === 'MANUAL') return project;
  if (
    !repoPartPattern.test(source.repositoryOwner) ||
    !repoPartPattern.test(source.repositoryName)
  )
    return project;
  if (
    source.kind === 'TEMPLATE_INDEX_JSON' &&
    source.metadataPath !== '.docs/index.json'
  )
    return project;

  const expectedUrl = new URL(
    `https://api.github.com/repos/${encodeURIComponent(source.repositoryOwner)}/${encodeURIComponent(source.repositoryName)}/contents/.docs/index.json`
  );
  if (
    source.kind === 'TEMPLATE_INDEX_JSON' &&
    source.indexUrl &&
    source.indexUrl !== expectedUrl.href
  )
    return project;
  try {
    const response = await fetch(
      source.kind === 'TEMPLATE_INDEX_JSON'
        ? (source.indexUrl ?? expectedUrl.href)
        : expectedUrl.href,
      {
        headers: { Accept: 'application/vnd.github+json' },
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!response.ok) return project;
    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('content' in payload) ||
      typeof payload.content !== 'string' ||
      payload.content.length > 45000
    )
      return project;
    const decoded = Buffer.from(payload.content, 'base64').toString('utf8');
    if (decoded.length > 32000) return project;
    const raw: unknown = JSON.parse(decoded);
    const parsedIndex = ProjectIndexSchema.safeParse(raw);
    if (!parsedIndex.success) return project;
    const metadata = parsedIndex.data;
    const merged = ProjectSchema.safeParse({
      ...project,
      ...metadata,
      links: {
        ...project.links,
        ...(typeof metadata.links === 'object' && metadata.links
          ? metadata.links
          : {}),
      },
      media: {
        ...project.media,
        ...(typeof metadata.media === 'object' && metadata.media
          ? metadata.media
          : {}),
      },
      dates: {
        ...project.dates,
        ...(typeof metadata.dates === 'object' && metadata.dates
          ? metadata.dates
          : {}),
      },
      ...(project.course &&
      typeof metadata.course === 'object' &&
      metadata.course
        ? { course: { ...project.course, ...metadata.course } }
        : {}),
      id: project.id,
      slug: project.slug,
    });
    return merged.success ? merged.data : project;
  } catch {
    return project;
  }
}
