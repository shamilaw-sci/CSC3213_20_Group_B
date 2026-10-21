import CourseManagementPage from '@/components/custom/course-management-page/CourseManagementPage';
import { loadCourseEditorData } from '@/lib/server/course-editor';

interface PageProps {
  params: Promise<{
    course: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { course } = await params;
  const data = await loadCourseEditorData(course);

  return (
    <CourseManagementPage
      courseId={course}
      initialUser={data.user}
      initialSchema={data.schema}
      initialCourse={data.course}
      initialPullRequest={data.pullRequest}
      initialOfferings={data.offerings}
    />
  );
}
