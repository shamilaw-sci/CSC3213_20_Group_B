import ProjectManagementPage from '@/components/custom/project-management-page/ProjectManagementPage';

interface PageProps {
  params: Promise<{
    project: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { project } = await params;

  return <ProjectManagementPage projectSlug={project} />;
}
