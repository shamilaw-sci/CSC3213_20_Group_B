'use client';

import JsonView from '@uiw/react-json-view';
import { githubDarkTheme } from '@uiw/react-json-view/githubDark';
import { githubLightTheme } from '@uiw/react-json-view/githubLight';
import { useTheme } from 'next-themes';

interface JsonPreviewProps {
  enableClipboard?: boolean;
  monospace?: boolean;
  value: object | undefined;
}

export function JsonPreview({
  value,
  enableClipboard = false,
  monospace = false,
}: JsonPreviewProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? githubDarkTheme : githubLightTheme;

  return (
    <div className="max-w-full overflow-x-auto rounded-md border bg-muted/45 p-3 text-sm sm:p-4">
      <JsonView
        value={value ?? {}}
        style={{
          ...theme,
          backgroundColor: 'transparent',
          ...(monospace
            ? {
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '13px',
              }
            : { fontSize: '0.875rem' }),
        }}
        displayDataTypes={false}
        displayObjectSize={enableClipboard}
        enableClipboard={enableClipboard}
        collapsed={2}
      />
    </div>
  );
}
