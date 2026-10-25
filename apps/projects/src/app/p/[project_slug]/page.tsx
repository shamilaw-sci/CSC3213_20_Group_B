import { permanentRedirect } from 'next/navigation';

type PageProps = {
  params: Promise<{
    project_slug: string;
  }>;
};

export default async function ShortProjectPage({ params }: PageProps) {
  const { project_slug: projectSlug } = await params;

  permanentRedirect(`/projects/${encodeURIComponent(projectSlug)}`);
}
