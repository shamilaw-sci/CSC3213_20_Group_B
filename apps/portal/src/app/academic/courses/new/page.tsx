import CourseManagementPage from '@/components/custom/course-management-page/CourseManagementPage';
import { loadNewCourseEditorData } from '@/lib/server/course-editor';

export default async function Page() {
  const data = await loadNewCourseEditorData();

  return (
    <CourseManagementPage
      newCourse
      initialUser={data.user}
      initialSchema={data.schema}
      initialOfferings={data.offerings}
    />
  );
}
