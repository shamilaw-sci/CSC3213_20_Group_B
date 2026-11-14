import { Badge } from '@scs/ui/components/badge';

import type { EditorRecordStatus } from '@/components/editor/editor-state';

const statusLabels: Record<EditorRecordStatus, string> = {
  new: 'New record',
  published: 'Published',
  draft: 'Unsaved changes',
  submitting: 'Submitting',
  succeeded: 'Submitted',
  failed: 'Needs attention',
};

interface EditorStatusProps {
  detail?: string;
  status: EditorRecordStatus;
}

export function EditorStatus({ detail, status }: EditorStatusProps) {
  const destructive = status === 'failed';

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      <Badge
        variant={destructive ? 'destructive' : 'outline'}
        className={
          status === 'published'
            ? `border-success-border bg-success-surface
              text-success-surface-foreground`
            : undefined
        }
      >
        {statusLabels[status]}
      </Badge>
      {detail ? (
        <span className="text-muted-foreground text-sm">{detail}</span>
      ) : null}
    </div>
  );
}
