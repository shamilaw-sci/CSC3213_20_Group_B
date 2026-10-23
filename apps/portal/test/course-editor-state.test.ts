import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const courseComponent = (path: string) =>
  readFileSync(
    resolve(import.meta.dir, `../src/components/courses/${path}`),
    'utf8'
  );

describe('guided course editor', () => {
  test('moves course management into app-owned course components', () => {
    expect(
      existsSync(
        resolve(
          import.meta.dir,
          '../src/components/custom/course-management-page/CourseManagementPage.tsx'
        )
      )
    ).toBe(false);
    expect(courseComponent('course-editor.tsx')).toContain('EditorWorkspace');
    expect(courseComponent('course-list.tsx')).toContain('Course Catalog');
  });

  test('groups the workflow into details, codes, departments, and offerings', () => {
    const editor = courseComponent('course-editor.tsx');

    expect(editor).toContain("label: 'Details'");
    expect(editor).toContain("label: 'Codes'");
    expect(editor).toContain("label: 'Departments'");
    expect(editor).toContain("label: 'Offerings'");
    expect(editor).toContain('state={editorState}');
  });

  test('keeps published comparison read-only and JSON permission-gated', () => {
    const editor = courseComponent('course-editor.tsx');
    const review = courseComponent('course-review.tsx');

    expect(editor).toContain('canEditJson={canEdit}');
    expect(editor).toContain('submitLabel="Submit Course Changes"');
    expect(editor).toContain('renderReview={(draft, published, onChangeField)');
    expect(review).toContain('Compare with Published');
    expect(review).toContain('Readonly<CourseRecord> | null');
    expect(review).not.toContain('onChange=');
  });

  test('links validation and review actions to stable course sections', () => {
    const sections = [
      'course-details-section.tsx',
      'course-codes-section.tsx',
      'course-departments-section.tsx',
      'course-offerings-section.tsx',
    ].map((path) => courseComponent(`sections/${path}`));
    const source = sections.join('\n');

    expect(source).toContain('id="course-details"');
    expect(source).toContain('id="course-codes"');
    expect(source).toContain('id="course-departments"');
    expect(source).toContain('id="course-offerings"');
  });

  test('uses explicit course and offering submission labels', () => {
    const editor = courseComponent('course-editor.tsx');

    expect(editor).toContain('Submit Course Changes');
    expect(editor).toContain('Add Course Offering');
    expect(editor).toContain('Submit Offering Changes');
    expect(editor).not.toContain('>Save<');
  });
});
