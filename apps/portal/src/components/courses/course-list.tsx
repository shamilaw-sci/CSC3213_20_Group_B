'use client';

import { Badge } from '@scs/ui/components/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { Input } from '@scs/ui/components/input';
import { Separator } from '@scs/ui/components/separator';
import { BookOpen, Search } from 'lucide-react';
import Link from 'next/link';

import type { CourseRecord } from '@/components/courses/course-review';
import { Pagination } from '@/components/navigation/pagination';

interface CourseListProps {
  courses: readonly CourseRecord[];
  nextHref?: string;
  onQueryChange: (value: string) => void;
  previousHref?: string;
  query: string;
}

export function CourseList({
  courses,
  nextHref,
  onQueryChange,
  previousHref,
  query,
}: CourseListProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Course Catalog</CardTitle>
          <CardDescription>
            Search by course identifier, title, or catalog code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search
              className="text-muted-foreground absolute top-1/2 left-3 size-4
                -translate-y-1/2"
            />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search courses"
              aria-label="Search courses"
              className="pl-9"
            />
          </div>
          <Separator />
          {courses.length === 0 ? (
            <div
              className="text-muted-foreground flex flex-col items-center gap-2
                py-10 text-center"
            >
              <BookOpen className="size-10 opacity-30" />
              <p className="text-sm">No courses match this search.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  href={`/academic/courses/${course.id}`}
                  className="bg-card hover:border-foreground/25
                    hover:bg-muted/30 rounded-md border p-4 shadow-sm
                    transition-[color,background-color,border-color]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{course.title}</h2>
                      <p className="text-muted-foreground text-sm">
                        {course.id}
                      </p>
                    </div>
                    <Badge variant="secondary">{course.primaryCode}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {course.codes.map((code) => (
                      <Badge key={code} variant="outline">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Pagination previousHref={previousHref} nextHref={nextHref} />
    </>
  );
}
