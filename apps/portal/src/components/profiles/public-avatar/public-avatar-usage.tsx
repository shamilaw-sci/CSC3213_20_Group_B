'use client';

import type { PublicAvatarQuota } from '@scs/schemas';
import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import { cn } from 'cn';
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

import { formatResetTime, quotaUsedPercent } from '@/lib/public-avatar';

interface PublicAvatarUsageProps {
  onRefresh: () => void;
  quota: PublicAvatarQuota | null | undefined;
  refreshing: boolean;
}

export function PublicAvatarUsage({
  onRefresh,
  quota,
  refreshing,
}: PublicAvatarUsageProps) {
  const reset = quota ? formatResetTime(quota.resetsAt) : null;
  const percent = quota ? quotaUsedPercent(quota) : 0;

  return (
    <section className="space-y-4" aria-labelledby="avatar-usage-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="avatar-usage-heading" className="text-base font-semibold">
            Upload usage
          </h2>
          <p className="text-muted-foreground text-sm">
            Hourly picture upload attempts for your account.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Refresh upload usage"
          title="Refresh upload usage"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
        </Button>
      </div>

      <div aria-live="polite" className="space-y-4">
        {quota ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span className="text-lg font-semibold">{quota.used}</span>
                <span className="text-muted-foreground">
                  {' '}
                  of {quota.limit} attempts used
                </span>
              </p>
              <Badge
                variant="outline"
                className={
                  quota.available
                    ? `border-success-border bg-success-surface
                      text-success-surface-foreground`
                    : `border-destructive-border bg-destructive-surface
                      text-destructive-surface-foreground`
                }
              >
                {quota.available ? (
                  <CheckCircle2 aria-hidden="true" />
                ) : (
                  <ShieldAlert aria-hidden="true" />
                )}
                {quota.available ? 'Available' : 'Limit reached'}
              </Badge>
            </div>

            <div
              role="progressbar"
              aria-label="Upload attempts used"
              aria-valuemin={0}
              aria-valuemax={quota.limit}
              aria-valuenow={quota.used}
              aria-valuetext={`${quota.used} of ${quota.limit} attempts used`}
              className="bg-muted h-2 overflow-hidden rounded-full"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width]',
                  quota.available ? 'bg-primary' : 'bg-destructive'
                )}
                style={{ width: `${percent}%` }}
              />
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/50 rounded-md p-3">
                <dt className="text-muted-foreground text-xs">Remaining</dt>
                <dd className="mt-1 text-base font-semibold">
                  {quota.remaining}
                </dd>
              </div>
              <div className="bg-muted/50 rounded-md p-3">
                <dt className="text-muted-foreground text-xs">
                  {quota.available ? 'Resets' : 'Upload again'}
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {reset ? (
                    <>
                      {reset.relative}
                      <span className="text-muted-foreground block text-xs">
                        at {reset.time}
                      </span>
                    </>
                  ) : (
                    'Unavailable'
                  )}
                </dd>
              </div>
            </dl>

            {!quota.available ? (
              <p
                className="border-destructive-border bg-destructive-surface
                  text-destructive-surface-foreground flex items-start gap-2
                  rounded-md border p-3 text-sm"
              >
                <Clock3 aria-hidden="true" className="mt-0.5 size-4" />
                <span>
                  You have used all {quota.limit} upload attempts in this hour.
                  {reset
                    ? ` You can upload again at ${reset.time} (${reset.relative}).`
                    : ' Try again after the limit resets.'}
                </span>
              </p>
            ) : null}
          </>
        ) : (
          <p
            className="border-warning-border bg-warning-surface
              text-warning-surface-foreground rounded-md border p-3 text-sm"
          >
            Upload usage is not available right now. Server-side upload limits
            still apply. Refresh to try again.
          </p>
        )}

        <p className="text-muted-foreground text-xs/5">
          Checking this status does not use an attempt. Each submitted upload
          counts, including files rejected by validation or the image check.
        </p>
      </div>
    </section>
  );
}
