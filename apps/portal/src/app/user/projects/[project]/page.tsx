import ProjectEditor from '@/components/projects/project-editor';
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
    <ProjectEditor
      projectSlug={project}
      initialUser={data.user}
      initialSchema={data.schema}
      initialProject={data.project}
      initialCourses={data.courses}
      initialOfferings={data.offerings}
    />
  );
}
