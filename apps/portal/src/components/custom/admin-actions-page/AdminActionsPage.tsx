'use client';

import { Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { BackButton } from '@/components/custom/back-button/back-button';
import {
  PageHeader,
  PageShell,
} from '@/components/custom/page-shell/page-shell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { adminActionApiUrl, apiHeaders, readApiError } from '@/lib/api';
import { AdminActionDefinition } from '@/types/admin-action';

interface AdminActionsPageProps {
  actions: AdminActionDefinition[];
}

type ActionResult = {
  status: 'success' | 'error';
  body: unknown;
};

function getActionModes(action: AdminActionDefinition): string[] {
  const modeSchema = action.requestSchema.properties?.mode;
  return modeSchema?.enum?.length ? modeSchema.enum : ['apply'];
}

export default function AdminActionsPage({ actions }: AdminActionsPageProps) {
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ActionResult>>({});

  async function runAction(action: AdminActionDefinition, mode: string) {
    const resultKey = `${action.id}:${mode}`;
    if (runningAction) return;

    if (mode === 'apply' || action.danger) {
      const confirmed = window.confirm(action.confirmation);
      if (!confirmed) return;
    }

    const requestBody: Record<string, string> = {};
    if (action.requestSchema.properties?.mode) {
      requestBody.mode = mode;
    }
    if (action.danger) {
      requestBody.confirmation = action.confirmation;
    }

    setRunningAction(resultKey);
    try {
      const response = await fetch(adminActionApiUrl(action.id), {
        method: action.method,
        credentials: 'include',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(requestBody),
      });

      const body = response.ok
        ? await response.json().catch(() => ({}))
        : await readApiError(response);

      setResults((current) => ({
        ...current,
        [resultKey]: {
          status: response.ok ? 'success' : 'error',
          body,
        },
      }));

      if (response.ok) {
        toast.success(`${action.title} completed`);
      } else {
        toast.error(
          'message' in body && typeof body.message === 'string'
            ? body.message
            : 'Action failed'
        );
      }
    } catch (error) {
      console.error('Admin action failed:', error);
      setResults((current) => ({
        ...current,
        [resultKey]: {
          status: 'error',
          body: { message: 'Action failed' },
        },
      }));
      toast.error('Action failed');
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <PageShell width="wide">
      <BackButton fallbackHref="/admin" label="Back to Admin" preferFallback />
      <PageHeader
        title="Admin Actions"
        description="Run schema-described maintenance actions when available."
      />

      <div className="space-y-4">
        {actions.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>No Actions Available</CardTitle>
              <CardDescription>
                There are no maintenance actions registered right now.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {actions.map((action) => {
          const modes = getActionModes(action);
          const latestResult = modes
            .map((mode) => results[`${action.id}:${mode}`])
            .findLast(Boolean);

          return (
            <Card key={action.id}>
              <CardHeader>
                <CardTitle>{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {modes.map((mode) => {
                    const resultKey = `${action.id}:${mode}`;
                    const isRunning = runningAction === resultKey;

                    return (
                      <Button
                        key={mode}
                        variant={mode === 'apply' ? 'default' : 'outline'}
                        onClick={() => runAction(action, mode)}
                        disabled={runningAction !== null}
                      >
                        {mode === 'apply' ? (
                          <Play className="size-4" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                        {isRunning
                          ? 'Running...'
                          : mode === 'dry_run'
                            ? 'Dry Run'
                            : 'Apply'}
                      </Button>
                    );
                  })}
                </div>

                {latestResult && (
                  <>
                    <Separator />
                    <pre className="bg-muted max-h-96 overflow-auto rounded-md p-4 text-xs">
                      {JSON.stringify(latestResult.body, null, 2)}
                    </pre>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
