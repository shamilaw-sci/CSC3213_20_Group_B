import { describe, expect, test } from 'bun:test';

import {
  applyAdvancedJson,
  createEditorState,
  discardAdvancedJson,
  editorTransitionClass,
  requestEditorSurface,
  stayOnAdvancedJson,
  updateAdvancedJson,
} from '@/components/editor/editor-state';

interface Draft {
  name: string;
  tags: string[];
}

const validateDraft = (value: unknown) => {
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { name?: unknown }).name === 'string' &&
    Array.isArray((value as { tags?: unknown }).tags)
  ) {
    return { success: true as const, data: value as Draft };
  }

  return {
    success: false as const,
    issues: [{ field: 'name', message: 'Name is required.' }],
  };
};

describe('editor state transitions', () => {
  test('Edit and Review share one canonical draft object', () => {
    const draft = { name: 'Current draft', tags: ['web'] };
    const published = { name: 'Published', tags: ['archive'] };
    const initial = createEditorState(draft, published);
    const review = requestEditorSurface(initial, 'review');
    const edit = requestEditorSurface(review, 'edit');

    expect(review.draft).toBe(draft);
    expect(edit.draft).toBe(draft);
    expect(edit.draft.tags).toEqual(['web']);
    expect(edit.published).toBe(published);
  });

  test('opening Advanced serializes the current draft, not Published', () => {
    const state = createEditorState(
      { name: 'Draft value', tags: [] },
      { name: 'Published value', tags: [] }
    );
    const advanced = requestEditorSurface(state, 'advanced');

    expect(advanced.json.text).toContain('Draft value');
    expect(advanced.json.text).not.toContain('Published value');
    expect(advanced.published).toBe(state.published);
  });

  test('dirty Advanced JSON requires Apply, Discard, or Stay before leaving', () => {
    const advanced = requestEditorSurface(
      createEditorState({ name: 'Draft', tags: [] }, null),
      'advanced'
    );
    const dirty = updateAdvancedJson(
      advanced,
      '{"name":"Changed","tags":["api"]}'
    );
    const requested = requestEditorSurface(dirty, 'review');

    expect(requested.surface).toBe('advanced');
    expect(requested.pendingSurface).toBe('review');

    const stayed = stayOnAdvancedJson(requested);
    expect(stayed.surface).toBe('advanced');
    expect(stayed.pendingSurface).toBeNull();

    const discarded = discardAdvancedJson(requested);
    expect(discarded.surface).toBe('review');
    expect(discarded.draft.name).toBe('Draft');
    expect(discarded.json.dirty).toBe(false);
  });

  test('invalid JSON and invalid domain data cannot replace the draft', () => {
    const draft = { name: 'Safe', tags: [] };
    const advanced = requestEditorSurface(
      createEditorState(draft, null),
      'advanced'
    );
    const malformed = applyAdvancedJson(
      updateAdvancedJson(advanced, '{invalid'),
      validateDraft
    );
    expect(malformed.draft).toBe(draft);
    expect(malformed.json.error).toBeTruthy();

    const invalid = applyAdvancedJson(
      updateAdvancedJson(advanced, '{"tags":[]}'),
      validateDraft
    );
    expect(invalid.draft).toBe(draft);
    expect(invalid.validationIssues).toEqual([
      { field: 'name', message: 'Name is required.' },
    ]);
  });

  test('Apply replaces the draft only after validation and completes departure', () => {
    const original = { name: 'Original', tags: [] };
    const requested = requestEditorSurface(
      updateAdvancedJson(
        requestEditorSurface(createEditorState(original, null), 'advanced'),
        '{"name":"Applied","tags":["ui"]}'
      ),
      'review'
    );
    const applied = applyAdvancedJson(requested, validateDraft);

    expect(applied.surface).toBe('review');
    expect(applied.draft).not.toBe(original);
    expect(applied.draft).toEqual({ name: 'Applied', tags: ['ui'] });
    expect(applied.pendingSurface).toBeNull();
    expect(applied.json.dirty).toBe(false);
  });

  test('reduced motion omits surface transition classes', () => {
    expect(editorTransitionClass(true)).toBe('');
    expect(editorTransitionClass(false)).toContain(
      'transition-[opacity,transform]'
    );
  });
});
