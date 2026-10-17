'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import AdminActionsPage from '@/components/custom/admin-actions-page/AdminActionsPage';
import { PageLoading } from '@/components/custom/loading/PageLoading';
import { adminActionsApiUrl, apiHeaders } from '@/lib/api';
import {
  AdminActionDefinition,
  AdminActionsResponse,
} from '@/types/admin-action';

export default function ManageActions() {
  const router = useRouter();
  const [actions, setActions] = useState<AdminActionDefinition[] | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadActions() {
      const response = await fetch(adminActionsApiUrl(), {
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
        window.location.href = '/?error=fetch_failed';
        return;
      }

      const body: AdminActionsResponse | null = await response
        .json()
        .catch(() => null);
      if (!body) {
        window.location.href = '/?error=fetch_failed';
        return;
      }

      if (mounted) {
        setActions(body.actions);
      }
    }

    loadActions().catch(() => {
      window.location.href = '/?error=fetch_failed';
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  if (!actions) {
    return <PageLoading variant="detail" />;
  }

  return <AdminActionsPage actions={actions} />;
}
