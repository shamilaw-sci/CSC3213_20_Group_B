import ProjectDetailPage from '@/views/projects/ProjectDetailPage';

type PageProps = {
  params: Promise<{
    project_slug: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { project_slug: projectSlug } = await params;

  return <ProjectDetailPage projectSlug={projectSlug} />;
}
