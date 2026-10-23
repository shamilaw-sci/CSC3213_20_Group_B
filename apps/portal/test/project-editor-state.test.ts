import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectComponent = (path: string) =>
  readFileSync(
    resolve(import.meta.dir, `../src/components/projects/${path}`),
    'utf8'
  );

describe('guided project editor', () => {
  test('replaces the legacy management page with app-owned project components', () => {
    expect(
      existsSync(
        resolve(
          import.meta.dir,
          '../src/components/custom/project-management-page/ProjectManagementPage.tsx'
        )
      )
    ).toBe(false);
    expect(projectComponent('project-editor.tsx')).toContain('EditorWorkspace');
    expect(projectComponent('project-list.tsx')).toContain('Project Registry');
  });

  test('starts with guided details and groups fields for non-technical users', () => {
    const editor = projectComponent('project-editor.tsx');

    expect(editor).toContain(
      'createEditorState(nextProject, projectBody.project)'
    );
    expect(editor).toContain('createEditorState(');
    expect(editor).toContain("label: 'Basics'");
    expect(editor).toContain("label: 'People'");
    expect(editor).toContain("label: 'Academic context'");
    expect(editor).toContain("label: 'Links'");
    expect(editor).toContain("label: 'Source'");
  });

  test('uses one canonical draft for edit, review, and permission-gated JSON', () => {
    const editor = projectComponent('project-editor.tsx');

    expect(editor).toContain('state={editorState}');
    expect(editor).toContain('renderReview={(draft, published, onChangeField)');
    expect(editor).toContain('canEditJson={canEdit}');
    expect(editor).toContain('submitLabel="Submit Project Changes"');
    expect(editor).not.toContain('setEditableProject(publishedProject)');
  });

  test('keeps published comparison read-only and links review rows to fields', () => {
    const review = projectComponent('project-review.tsx');

    expect(review).toContain('Compare with Published');
    expect(review).toContain('Readonly<ProjectRecord> | null');
    expect(review).toContain('<ReviewChanges');
    expect(review).toContain('onChangeField={onChangeField}');
    expect(review).not.toContain('onChange=');
  });

  test('provides stable field targets for validation and change actions', () => {
    const sections = [
      'project-basics-section.tsx',
      'project-people-section.tsx',
      'project-academic-section.tsx',
      'project-links-section.tsx',
      'project-source-section.tsx',
    ].map((path) => projectComponent(`sections/${path}`));

    expect(sections.join('\n')).toContain('id="project-title"');
    expect(sections.join('\n')).toContain('id="project-people"');
    expect(sections.join('\n')).toContain('id="project-academic"');
    expect(sections.join('\n')).toContain('id="project-links"');
    expect(sections.join('\n')).toContain('id="project-source"');
  });
});
