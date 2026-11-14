'use client';

import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@scs/ui/components/tooltip';
import { BadgeCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { apiHeaders, apiUrl, readApiError } from '@/lib/api';

export function OrcidConnection({
  inPublicProfile = false,
  onBeforeNavigate,
}: {
  inPublicProfile?: boolean;
  onBeforeNavigate?: () => void;
}) {
  const [orcid, setOrcid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get('orcid');
    if (status !== 'connected' && status !== 'failed') return;
    if (status === 'connected') toast.success('ORCID connected');
    else toast.error('ORCID connection was not completed');
    url.searchParams.delete('orcid');
    window.history.replaceState(window.history.state, '', url);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(apiUrl('/api/orcid/me'), {
      credentials: 'include',
      headers: apiHeaders(),
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error((await readApiError(response)).message);
        return response.json() as Promise<{ orcid: string | null }>;
      })
      .then((result) => {
        if (active) setOrcid(result.orcid);
      })
      .catch(() => {
        if (active) toast.error('Unable to load ORCID connection');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const response = await fetch(apiUrl('/api/orcid/connect'), {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders(),
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      const body = (await response.json()) as { url: string };
      onBeforeNavigate?.();
      window.location.assign(body.url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to connect ORCID'
      );
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const response = await fetch(apiUrl('/api/orcid/me'), {
        method: 'DELETE',
        credentials: 'include',
        headers: apiHeaders(),
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      setOrcid(null);
      toast.success('ORCID disconnected');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to disconnect ORCID'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {inPublicProfile
            ? 'ORCID'
            : orcid
              ? 'Connected ORCID'
              : 'Connect your ORCID'}
        </CardTitle>
        <CardDescription>
          {orcid
            ? 'Your ORCID iD is linked to this account.'
            : inPublicProfile
              ? 'Connect your ORCID account to verify your researcher identifier and display your public research outputs.'
              : 'Connect your ORCID account to display your verified researcher identifier and automatically retrieve your public research outputs.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {orcid ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">Connected</Badge>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="text-info-surface-foreground inline-flex
                        items-center gap-1 text-sm font-medium"
                      aria-label="Verified ORCID iD"
                    >
                      <BadgeCheck aria-hidden="true" className="size-4" />
                      Verified
                    </button>
                  }
                />
                <TooltipContent>
                  This ORCID iD was confirmed when you connected through ORCID.
                </TooltipContent>
              </Tooltip>
              <a
                href={`https://orcid.org/${orcid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                ORCID {orcid}
              </a>
            </div>
            <div>
              <h3 className="font-medium">
                Manage your research through ORCID
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {inPublicProfile
                  ? 'Manage research outputs on ORCID. Public outputs appear on your SCS-PDN profile automatically; updates may take up to one hour.'
                  : 'Your public research outputs are retrieved automatically from ORCID. Add or update your publications, datasets, software, and other research contributions on ORCID, and they can appear on your SCS-PDN public profile.'}
              </p>
              {!inPublicProfile && (
                <p className="text-muted-foreground mt-2 text-sm">
                  You don&apos;t need to add them separately here. Only publicly
                  visible research outputs are included, and updates may take up
                  to one hour to appear.
                </p>
              )}
              <a
                href="https://orcid.org/my-orcid"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 inline-block underline"
              >
                Manage on ORCID
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={busy || loading}
                onClick={() => void connect()}
              >
                Replace ORCID
              </Button>
              <Button
                variant="outline"
                className="border-destructive-border bg-destructive-surface
                  text-destructive-surface-foreground
                  hover:bg-destructive-surface/80
                  hover:text-destructive-surface-foreground"
                disabled={busy || loading}
                onClick={() => void disconnect()}
              >
                Disconnect ORCID
              </Button>
            </div>
          </>
        ) : (
          <Button disabled={busy || loading} onClick={() => void connect()}>
            Connect ORCID
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
