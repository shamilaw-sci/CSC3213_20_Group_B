import { describe, expect, it } from 'bun:test';

import type {
  AcademicPeriod,
  AdminAvatarReviewPage,
  CourseOffering,
  Page,
  ProjectCourse,
  PublicAvatarReview,
  Semester,
} from '#index';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

type Assert<Condition extends true> = Condition;

type TypeAssertions = {
  semesterMatchesEnum: Assert<Equal<Semester, 'SEM1' | 'SEM2'>>;
  academicPeriodReusesSemester: Assert<
    Equal<AcademicPeriod['semester'], Semester>
  >;
  courseOfferingReusesSemester: Assert<
    Equal<CourseOffering['semester'], Semester>
  >;
  projectCourseReusesSemester: Assert<
    Equal<ProjectCourse['semester'], Semester | undefined>
  >;
  avatarReviewPageUsesPageType: Assert<
    Equal<AdminAvatarReviewPage, Page<PublicAvatarReview>>
  >;
};

describe('schema type unification', () => {
  it('keeps shared enum and page types structurally aligned', () => {
    const assertions: TypeAssertions = {
      semesterMatchesEnum: true,
      academicPeriodReusesSemester: true,
      courseOfferingReusesSemester: true,
      projectCourseReusesSemester: true,
      avatarReviewPageUsesPageType: true,
    };

    expect(Object.values(assertions).every(Boolean)).toBe(true);
  });
});
