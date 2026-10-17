import CourseManagementPage from '@/components/custom/course-management-page/CourseManagementPage';

interface PageProps {
  params: Promise<{
    course: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { course } = await params;

  return <CourseManagementPage courseId={course} />;
}
