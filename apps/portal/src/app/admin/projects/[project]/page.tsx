import { redirect } from 'next/navigation';

import ProjectEditor from '@/components/projects/project-editor';
import { loadProjectEditorData } from '@/lib/server/project-editor';
import { isSuperAdminRole } from '@/types/role';

interface PageProps {
  params: Promise<{
    project: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { project } = await params;
  const data = await loadProjectEditorData(project);
  if (!isSuperAdminRole(data.user)) redirect('/dashboard');

  return (
    <ProjectEditor
      admin
      projectSlug={project}
      initialUser={data.user}
      initialSchema={data.schema}
      initialProject={data.project}
      initialCourses={data.courses}
      initialOfferings={data.offerings}
    />
  );
}
