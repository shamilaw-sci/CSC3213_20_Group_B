import type { ProjectType } from '@scs/schemas';

import {
  buildCollectionPath,
  canonicalizeCollectionSegment,
  canonicalizeSearchSegment,
  parseCollectionPage,
  PROJECT_TYPE_SEGMENTS,
  type ProjectCollection,
  resolveProjectTypeSegment,
} from '@/lib/projects/collection-navigation';

const expectedTypeSegments: Record<ProjectType, string> = {
  COURSE_PROJECT: 'course-projects',
  RESEARCH_PROJECT: 'research-projects',
  STUDENT_INNOVATION: 'student-innovations',
  OPEN_SOURCE: 'open-source',
  DEPARTMENT_SYSTEM: 'department-systems',
  DATASET: 'datasets',
  PUBLICATION_ARTIFACT: 'publication-artifacts',
  INDUSTRY_COLLABORATION: 'industry-collaborations',
  FACULTY_COLLABORATION: 'faculty-collaborations',
  HACKATHON: 'hackathons',
  OTHER: 'other',
};

describe('project collection navigation', () => {
  test('maps every project type to its stable public path and back', () => {
    expect(PROJECT_TYPE_SEGMENTS).toEqual(expectedTypeSegments);

    for (const [projectType, segment] of Object.entries(
      expectedTypeSegments
    ) as [ProjectType, string][]) {
      const collection: ProjectCollection = { kind: 'type', projectType };

      expect(buildCollectionPath(collection)).toBe(`/types/${segment}`);
      expect(resolveProjectTypeSegment(segment)).toBe(projectType);
    }

    expect(resolveProjectTypeSegment('RESEARCH_PROJECT')).toBeNull();
    expect(resolveProjectTypeSegment('unknown')).toBeNull();
  });

  test('builds collection and pagination paths without query strings', () => {
    expect(buildCollectionPath({ kind: 'browse' })).toBe('/browse');
    expect(buildCollectionPath({ kind: 'browse' }, 2)).toBe('/browse/page/2');
    expect(buildCollectionPath({ kind: 'category', value: 'Research' })).toBe(
      '/categories/research'
    );
    expect(buildCollectionPath({ kind: 'topic', value: 'C++' })).toBe(
      '/topics/c%2B%2B'
    );
    expect(buildCollectionPath({ kind: 'search', query: 'C#' })).toBe(
      '/search/c%23'
    );
  });

  test('normalizes Unicode, delimiters, and canonical collisions', () => {
    expect(canonicalizeCollectionSegment('  Ｒesearch / Systems  ')).toBe(
      'research-systems'
    );
    expect(canonicalizeCollectionSegment('පර්යේෂණ \\ දත්ත')).toBe(
      'පර්යේෂණ-දත්ත'
    );
    expect(canonicalizeCollectionSegment('Research   Systems')).toBe(
      canonicalizeCollectionSegment('research/systems')
    );
    expect(canonicalizeSearchSegment('  C++ / data  ')).toBe('c++-data');
  });

  test('accepts only the canonical optional pagination grammar', () => {
    expect(parseCollectionPage()).toBe(1);
    expect(parseCollectionPage([])).toBe(1);
    expect(parseCollectionPage(['page', '2'])).toBe(2);

    for (const segments of [
      ['2'],
      ['page'],
      ['page', '0'],
      ['page', '-1'],
      ['page', '1.5'],
      ['page', 'two'],
      ['page', '2', 'extra'],
    ]) {
      expect(parseCollectionPage(segments)).toBeNull();
    }
  });
});
