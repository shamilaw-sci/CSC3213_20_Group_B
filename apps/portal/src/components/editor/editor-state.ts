export type EditorSurface = 'edit' | 'review' | 'advanced';

export type EditorRecordStatus =
  'new' | 'published' | 'draft' | 'submitting' | 'succeeded' | 'failed';

export interface EditorValidationIssue {
  field: string;
  message: string;
}

type EditorValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: EditorValidationIssue[] };

export type EditorValidator<T> = (value: unknown) => EditorValidationResult<T>;

export interface EditorState<T> {
  draft: T;
  json: {
    dirty: boolean;
    error: string | null;
    text: string;
  };
  pendingSurface: EditorSurface | null;
  published: Readonly<T> | null;
  surface: EditorSurface;
  validationIssues: EditorValidationIssue[];
}

function serializeDraft<T>(draft: T) {
  return JSON.stringify(draft, null, 2);
}

export function createEditorState<T>(
  draft: T,
  published: Readonly<T> | null
): EditorState<T> {
  return {
    draft,
    published,
    surface: 'edit',
    pendingSurface: null,
    json: {
      text: serializeDraft(draft),
      dirty: false,
      error: null,
    },
    validationIssues: [],
  };
}

export function requestEditorSurface<T>(
  current: EditorState<T>,
  target: EditorSurface
): EditorState<T> {
  if (target === current.surface) return current;

  if (current.surface === 'advanced' && current.json.dirty) {
    return { ...current, pendingSurface: target };
  }

  if (target === 'advanced') {
    return {
      ...current,
      surface: target,
      pendingSurface: null,
      json: {
        text: serializeDraft(current.draft),
        dirty: false,
        error: null,
      },
      validationIssues: [],
    };
  }

  return { ...current, surface: target, pendingSurface: null };
}

export function updateEditorDraft<T>(
  current: EditorState<T>,
  draft: T
): EditorState<T> {
  return { ...current, draft, validationIssues: [] };
}

export function updateAdvancedJson<T>(
  current: EditorState<T>,
  text: string
): EditorState<T> {
  return {
    ...current,
    json: { text, dirty: true, error: null },
    validationIssues: [],
  };
}

export function applyAdvancedJson<T>(
  current: EditorState<T>,
  validate: EditorValidator<T>
): EditorState<T> {
  let value: unknown;

  try {
    value = JSON.parse(current.json.text);
  } catch {
    return {
      ...current,
      json: {
        ...current.json,
        error: 'The JSON is not valid. Fix the syntax before applying it.',
      },
      validationIssues: [],
    };
  }

  const result = validate(value);
  if (!result.success) {
    return {
      ...current,
      json: { ...current.json, error: null },
      validationIssues: result.issues,
    };
  }

  return {
    ...current,
    draft: result.data,
    surface: current.pendingSurface ?? current.surface,
    pendingSurface: null,
    json: {
      text: serializeDraft(result.data),
      dirty: false,
      error: null,
    },
    validationIssues: [],
  };
}

export function discardAdvancedJson<T>(
  current: EditorState<T>
): EditorState<T> {
  return {
    ...current,
    surface: current.pendingSurface ?? current.surface,
    pendingSurface: null,
    json: {
      text: serializeDraft(current.draft),
      dirty: false,
      error: null,
    },
    validationIssues: [],
  };
}

export function stayOnAdvancedJson<T>(current: EditorState<T>): EditorState<T> {
  return { ...current, pendingSurface: null };
}

export function editorTransitionClass(reducedMotion: boolean) {
  return reducedMotion
    ? ''
    : 'transition-[opacity,transform] duration-150 ease-out';
}
