import Course from '@/app/courses/[course_code]/projects/_components/course';

type PageProps = {
  params: Promise<{
    course_code: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { course_code: courseCode } = await params;

  return <Course courseCode={courseCode} />;
}
