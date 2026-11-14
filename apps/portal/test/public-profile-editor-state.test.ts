import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const profileComponent = (path: string) =>
  readFileSync(
    resolve(import.meta.dir, `../src/components/profiles/${path}`),
    'utf8'
  );

describe('guided public profile editor', () => {
  test('moves profile editing out of custom components', () => {
    expect(
      existsSync(
        resolve(
          import.meta.dir,
          '../src/components/custom/public-profile-page/PublicProfilePage.tsx'
        )
      )
    ).toBe(false);
    expect(profileComponent('public-profile-editor.tsx')).toContain(
      'EditorWorkspace'
    );
  });

  test('uses plain-language guided sections and one canonical draft', () => {
    const editor = profileComponent('public-profile-editor.tsx');

    expect(editor).toContain("label: 'About you'");
    expect(editor).toContain("label: 'Role and affiliation'");
    expect(editor).toContain("label: 'Work and studies'");
    expect(editor).toContain("label: 'Links'");
    expect(editor).toContain('state={editorState}');
    expect(editor).toContain('submitLabel="Submit Profile Changes"');
  });

  test('explains locked university-managed fields', () => {
    const editor = profileComponent('public-profile-editor.tsx');

    expect(editor).toContain('Managed by university records');
    expect(editor).toContain('lockedFields={lockedFields}');
  });

  test('keeps published comparison read-only and JSON editing guarded', () => {
    const editor = profileComponent('public-profile-editor.tsx');
    const review = profileComponent('public-profile-review.tsx');

    expect(editor).toContain('canEditJson');
    expect(editor).toContain('renderReview={(draft, published, onChangeField)');
    expect(review).toContain('Compare with Published');
    expect(review).toContain('Readonly<ProfileRecord> | null');
    expect(review).not.toContain('onChange=');
  });

  test('retains both user and admin profile routes', () => {
    const userRoute = readFileSync(
      resolve(import.meta.dir, '../src/app/user/me/public-profile/page.tsx'),
      'utf8'
    );
    const adminRoute = readFileSync(
      resolve(
        import.meta.dir,
        '../src/app/admin/users/[email]/public-profile/page.tsx'
      ),
      'utf8'
    );

    expect(userRoute).toContain('from="profile"');
    expect(adminRoute).toContain('targetEmail={targetEmail}');
    expect(adminRoute).toContain('initialData={initialData}');
  });

  test('keeps independent picture and ORCID actions before PR details', () => {
    const editor = profileComponent('public-profile-editor.tsx');
    const picture = editor.indexOf('<CardTitle>Profile Picture</CardTitle>');
    const orcid = editor.indexOf('<OrcidConnection');
    const details = editor.indexOf(
      '<CardTitle>Public Profile Details</CardTitle>'
    );
    const notice = editor.indexOf('<PublicationNotice');

    expect(picture).toBeGreaterThan(0);
    expect(orcid).toBeGreaterThan(picture);
    expect(details).toBeGreaterThan(orcid);
    expect(notice).toBeGreaterThan(orcid);
    expect(details).toBeGreaterThan(notice);
    expect(editor).toContain('<CardTitle>Publication status</CardTitle>');
    expect(editor).not.toContain('<CardTitle>Pending PR</CardTitle>');
    expect(editor).not.toContain('Edits update the current open PR.');
    expect(editor).toContain("pr?.status !== 'none'");
    expect(editor).toContain('submitLabel="Submit Profile Changes"');
  });

  test('removes the superseded editor selector after migration', () => {
    expect(
      existsSync(
        resolve(
          import.meta.dir,
          '../src/components/custom/editor-view-controls/editor-view-controls.tsx'
        )
      )
    ).toBe(false);
  });
});
