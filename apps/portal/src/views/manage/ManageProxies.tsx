'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageLoading } from '@/components/custom/loading/PageLoading';
import ManageProxiesPage from '@/components/custom/manage-proxies-page/ManageProxiesPage';
import { adminProxiesPageApiUrl, apiHeaders, readApiError } from '@/lib/api';
import { AdminProxyPageResponse } from '@/types/proxy';

interface ManageProxiesProps {
  cursor?: string;
}

export default function ManageProxies({ cursor }: ManageProxiesProps) {
  const router = useRouter();
  const [data, setData] = useState<AdminProxyPageResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProxies() {
      const response = await fetch(adminProxiesPageApiUrl(cursor), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });
      if (response.status === 401) {
        window.location.href = '/logout';
        return;
      }
      if (response.status === 403) {
        router.replace('/dashboard');
        return;
      }
      if (!response.ok) {
        const error = await readApiError(response);
        throw new Error(error.message ?? 'Failed to fetch proxy settings');
      }
      const nextData = (await response.json()) as AdminProxyPageResponse;

      if (mounted) {
        setData(nextData);
      }
    }

    loadProxies().catch(() => {
      window.location.href = '/?error=fetch_failed';
    });

    return () => {
      mounted = false;
    };
  }, [cursor, router]);

  if (!data) {
    return <PageLoading variant="table" />;
  }

  return (
    <ManageProxiesPage
      proxies={data.items}
      nextCursor={data.page.nextCursor}
      hasPrevious={Boolean(cursor)}
      total={data.page.total}
    />
  );
}
