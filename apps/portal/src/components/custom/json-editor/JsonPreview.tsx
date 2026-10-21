'use client';

import JsonView from '@uiw/react-json-view';
import { githubDarkTheme } from '@uiw/react-json-view/githubDark';
import { githubLightTheme } from '@uiw/react-json-view/githubLight';
import { useTheme } from 'next-themes';

interface JsonPreviewProps {
  value: object | undefined;
  enableClipboard?: boolean;
  monospace?: boolean;
}

export function JsonPreview({
  value,
  enableClipboard = false,
  monospace = false,
}: JsonPreviewProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? githubDarkTheme : githubLightTheme;

  return (
    <div className="max-w-full overflow-x-auto rounded-md border bg-[#f6f8fa] p-3 text-sm sm:p-4 dark:bg-[#0d1117]">
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
