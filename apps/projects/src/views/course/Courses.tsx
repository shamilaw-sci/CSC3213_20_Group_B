'use client';

import { Badge } from '@scs/ui/components/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  ProjectErrorPanel,
  StatePanel,
  TileGridLoading,
} from '@/components/custom/StatePanel';
import { fetchCourses, type ProjectCourse } from '@/lib/projects/api-client';
import { PageIntro } from '@/views/projects/RegistryUI';

export default function Courses() {
  const [courses, setCourses] = useState<ProjectCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCourses() {
      try {
        setCourses(await fetchCourses(controller.signal));
        setLoadFailed(false);
      } catch {
        if (!controller.signal.aborted) {
          setCourses([]);
          setLoadFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCourses();

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  return (
    <>
      <PageIntro
        eyebrow="Optional academic relationship"
        title="Course projects"
        description="Browse projects connected to SCS courses. For research, systems, datasets, and other work, use Search, Tags, or Categories."
      />
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <TileGridLoading
            className="md:col-span-2 lg:col-span-3"
            label="Loading courses"
          />
        ) : null}
        {!loading && loadFailed ? (
          <ProjectErrorPanel
            title="Courses could not be loaded"
            description="Course filters depend on the published project registry, which is unavailable right now."
            onRetry={() => setReloadKey((key) => key + 1)}
            className="md:col-span-2 lg:col-span-3"
          />
        ) : null}
        {!loading && !loadFailed && courses.length === 0 ? (
          <StatePanel
            title="No course-linked projects yet"
            description="Projects do not need to belong to a course. Browse collections or search the full registry instead."
            action={{ href: '/categories', label: 'Browse collections' }}
            secondaryAction={{ href: '/search', label: 'Search projects' }}
            className="md:col-span-2 lg:col-span-3"
          />
        ) : null}
        {courses.map((course) => (
          <Link
            key={course.code}
            href={`/courses/${course.code}/projects`}
            className="group block"
          >
            <Card className="h-full rounded-md p-5 transition group-hover:-translate-y-0.5 group-hover:bg-muted/35 group-hover:shadow-lg">
              <CardHeader className="px-0">
                <Badge className="w-fit rounded-md">{course.code}</Badge>
                <CardTitle className="mt-3 text-xl">{course.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <p className="text-sm text-muted-foreground">
                  {course.count} projects
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </>
  );
}
