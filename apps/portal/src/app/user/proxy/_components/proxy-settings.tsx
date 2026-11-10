'use client';

import { AdminProxySettingsSchema } from '@scs/schemas';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import ProxySettingsPage from '@/app/user/proxy/_components/proxy-settings-form';
import { SettingsPageLoading } from '@/components/feedback/page-loading';
import { apiHeaders, readApiError, userProxyApiUrl } from '@/lib/api';

const UserProxyResponseSchema = z.object({
  proxy: AdminProxySettingsSchema.pick({
    active: true,
    url: true,
    availableAttempts: true,
  }).partial({ availableAttempts: true }),
});

export default function ProxySettings() {
  const router = useRouter();
  const [proxy, setProxy] = useState<{
    active: boolean;
    url: string;
    availableAttempts: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProxy() {
      const response = await fetch(userProxyApiUrl(), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });
      if (response.status === 401) {
        router.replace('/logout');
        return;
      }
      if (!response.ok) {
        const error = await readApiError(response);
        throw new Error(error.message ?? 'Failed to fetch redirect settings');
      }
      const data = UserProxyResponseSchema.parse(await response.json());
      const proxyData = data.proxy;

      if (mounted) {
        setProxy({
          active: proxyData.active,
          url: proxyData.url,
          availableAttempts: proxyData.availableAttempts ?? 5,
        });
      }
    }

    loadProxy().catch(() => {
      router.replace('/?error=fetch_failed');
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  if (!proxy) {
    return <SettingsPageLoading />;
  }

  return (
    <ProxySettingsPage
      active={proxy.active}
      url={proxy.url}
      availableAttempts={proxy.availableAttempts}
    />
  );
}
