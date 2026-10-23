import CourseEditor from '@/components/courses/course-editor';
import { loadNewCourseEditorData } from '@/lib/server/course-editor';

export default async function Page() {
  const data = await loadNewCourseEditorData();

  return (
    <CourseEditor
      newCourse
      initialUser={data.user}
      initialSchema={data.schema}
      initialOfferings={data.offerings}
    />
  );
}
