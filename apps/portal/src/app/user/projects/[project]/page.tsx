import ProjectManagementPage from '@/components/custom/project-management-page/ProjectManagementPage';
import { loadProjectEditorData } from '@/lib/server/project-editor';

interface PageProps {
  params: Promise<{
    project: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { project } = await params;
  const data = await loadProjectEditorData(project);

  return (
    <ProjectManagementPage
      projectSlug={project}
      initialUser={data.user}
      initialSchema={data.schema}
      initialProject={data.project}
      initialCourses={data.courses}
      initialOfferings={data.offerings}
    />
  );
}
