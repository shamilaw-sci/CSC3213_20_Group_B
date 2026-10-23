'use client';

import { useEffect, useState } from 'react';

import ProjectCollection from '@/components/projects/project-collection';
import { fetchCourses, type ProjectCourse } from '@/lib/projects/api-client';

export default function Course({
  courseCode,
}: Readonly<{ courseCode: string }>) {
  const [courses, setCourses] = useState<ProjectCourse[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCourses() {
      try {
        setCourses(await fetchCourses(controller.signal));
      } catch {
        if (!controller.signal.aborted) {
          setCourses([]);
        }
      }
    }

    void loadCourses();

    return () => {
      controller.abort();
    };
  }, []);

  const course = courses.find(
    (item) => item.code.toLowerCase() === courseCode.toLowerCase()
  );
  const title = course ? `${course.code} projects` : `${courseCode} projects`;
  const courseTitle = course?.title ?? courseCode;

  return (
    <ProjectCollection
      eyebrow="Course filter"
      title={title}
      description={`Projects connected to ${courseTitle}. Some SCS projects are linked to courses, while others are research, systems, datasets, or collaborations.`}
      filters={{ course: courseCode }}
    />
  );
}
