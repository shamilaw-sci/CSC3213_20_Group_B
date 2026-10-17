'use client';

import { useEffect, useState } from 'react';

import { PageLoading } from '@/components/custom/loading/PageLoading';
import ProxySettingsPage from '@/components/custom/proxy-settings-page/ProxySettingsPage';
import { userProxyReadUrlApiUrl } from '@/lib/api';
import { ConfigFetchError, fetchUserProxyConfig } from '@/lib/proxy-config';

export default function ProxySettings() {
  const [proxy, setProxy] = useState<{
    active: boolean;
    url: string;
    availableAttempts: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProxy() {
      const data = await fetchUserProxyConfig(userProxyReadUrlApiUrl());
      const proxyData = data?.proxy ?? {
        active: false,
        url: '',
        availableAttempts: 5,
      };

      if (mounted) {
        setProxy({
          active: proxyData.active,
          url: proxyData.url,
          availableAttempts: proxyData.availableAttempts ?? 5,
        });
      }
    }

    loadProxy().catch((error: unknown) => {
      if (error instanceof ConfigFetchError && error.status === 401) {
        window.location.href = '/logout';
        return;
      }
      window.location.href = '/?error=fetch_failed';
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!proxy) {
    return <PageLoading variant="detail" />;
  }

  return (
    <ProxySettingsPage
      active={proxy.active}
      url={proxy.url}
      availableAttempts={proxy.availableAttempts}
    />
  );
}
