'use client';

import { json } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { useTheme } from 'next-themes';

interface JsonEditorProps {
  height?: string;
  minHeight?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  value: string;
}

export function JsonEditor({
  value,
  onChange,
  readOnly = false,
  minHeight = '520px',
  height = 'min(62vh, 720px)',
}: JsonEditorProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="max-w-full overflow-x-auto rounded-md border">
      <CodeMirror
        className="w-full max-w-full"
        value={value}
        minHeight={minHeight}
        height={height}
        extensions={[json()]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: !readOnly,
        }}
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        readOnly={readOnly}
        editable={!readOnly}
        onChange={onChange}
      />
    </div>
  );
}
