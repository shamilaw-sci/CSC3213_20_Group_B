'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageLoading } from '@/components/custom/loading/PageLoading';
import ManageProxiesPage from '@/components/custom/manage-proxies-page/ManageProxiesPage';
import { userProxyAllReadUrlApiUrl } from '@/lib/api';
import { ConfigFetchError, fetchAllProxyConfig } from '@/lib/proxy-config';
import { AdminProxyListResponse } from '@/types/proxy';

interface ManageProxiesProps {
  page?: number;
}

export default function ManageProxies({ page = 1 }: ManageProxiesProps) {
  const router = useRouter();
  const [data, setData] = useState<AdminProxyListResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProxies() {
      const raw = await fetchAllProxyConfig(userProxyAllReadUrlApiUrl());
      const entries = Object.entries(raw?.users ?? {}).map(
        ([email, entry]) => ({
          email,
          username: entry.username,
          active: entry.proxy.active,
          url: entry.proxy.url,
          availableAttempts: entry.proxy.availableAttempts ?? 5,
          updatedAt: entry.proxy.updatedAt,
          updatedBy: entry.proxy.updatedBy,
        })
      );
      const sortedEntries = entries.sort((a, b) =>
        a.email.localeCompare(b.email)
      );
      const total = sortedEntries.length;
      const totalPages = Math.max(1, Math.ceil(total / 100));
      const start = (page - 1) * 100;
      const nextData = {
        proxies: sortedEntries.slice(start, start + 100),
        page,
        totalPages,
        total,
      };

      if (mounted) {
        setData(nextData);
      }
    }

    loadProxies().catch((error: unknown) => {
      if (error instanceof ConfigFetchError && error.status === 401) {
        window.location.href = '/logout';
        return;
      }
      if (error instanceof ConfigFetchError && error.status === 403) {
        router.replace('/dashboard');
        return;
      }
      window.location.href = '/?error=fetch_failed';
    });

    return () => {
      mounted = false;
    };
  }, [page, router]);

  if (!data) {
    return <PageLoading variant="table" />;
  }

  return (
    <ManageProxiesPage
      proxies={data.proxies}
      page={data.page ?? page}
      totalPages={data.totalPages ?? 1}
      total={data.total ?? data.proxies.length}
    />
  );
}
