'use client';

import {
  BookOpen,
  FolderKanban,
  IdCard,
  Network,
  Settings,
  ShieldCheck,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { LogoutButton } from '@/components/auth/logout-button';
import { PageLoading } from '@/components/feedback/page-loading';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { apiHeaders, meApiUrl } from '@/lib/api';
import {
  ACCESS_LEVEL,
  APP_ROLE,
  canEditCoursesRole,
  getUserAccessLevel,
  getUserRole,
  isSuperAdminRole,
} from '@/types/role';

export default function Dashboard() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showCourses, setShowCourses] = useState(false);
  const [showProxySettings, setShowProxySettings] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      const res = await fetch(meApiUrl(), {
        credentials: 'include',
        cache: 'no-store',
        headers: apiHeaders(),
      });

      if (!res.ok) {
        window.location.href = '/logout';
        return;
      }

      const user = await res.json().catch(() => null);
      if (!user) {
        window.location.href = '/?error=fetch_failed';
        return;
      }

      const hasProxySettings =
        getUserRole(user) !== APP_ROLE.USER ||
        getUserAccessLevel(user) !== ACCESS_LEVEL.NONE;

      if (mounted) {
        setIsSuperAdmin(isSuperAdminRole(user));
        setShowCourses(canEditCoursesRole(user));
        setShowProxySettings(hasProxySettings);
        setLoaded(true);
      }
    }

    loadDashboard().catch(() => {
      window.location.href = '/?error=fetch_failed';
    });

    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo(() => {
    const baseItems = [
      ...(showCourses
        ? [
            {
              title: 'Courses',
              href: '/academic/courses',
              description: 'Create, edit, and manage course information.',
              icon: BookOpen,
            },
          ]
        : []),
      {
        title: 'Projects',
        href: '/user/projects',
        description: 'View and manage student or research projects.',
        icon: FolderKanban,
      },
      {
        title: 'My Profile',
        href: '/user/me',
        description: 'View and update your personal profile details.',
        icon: User,
      },
      {
        title: 'Public Profile',
        href: '/account/public-profile',
        description: 'Edit your people directory profile and PR status.',
        icon: IdCard,
      },
      {
        title: 'Account Settings',
        href: '/account/settings',
        description: 'Configure account preferences and security settings.',
        icon: Settings,
      },
    ];

    if (isSuperAdmin) {
      baseItems.unshift({
        title: 'Admin',
        href: '/admin',
        description: 'Open admin tools for users and proxy configurations.',
        icon: ShieldCheck,
      });
    }

    if (showProxySettings) {
      baseItems.push({
        title: 'Proxy Settings',
        href: '/user/proxy',
        description: 'Configure your proxy connection settings.',
        icon: Network,
      });
    }

    return baseItems;
  }, [isSuperAdmin, showCourses, showProxySettings]);

  if (!loaded) return <PageLoading />;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Dashboard"
        description="Quick access to portal tools and account areas."
        action={<LogoutButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group bg-card text-card-foreground
                hover:border-foreground/25 hover:bg-muted/30 flex min-h-32
                items-start gap-4 rounded-md border p-5 shadow-sm
                transition-colors"
            >
              <div
                className="bg-background flex size-10 shrink-0 items-center
                  justify-center rounded-md border"
              >
                <Icon
                  className="text-muted-foreground group-hover:text-foreground
                    size-5 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">{item.title}</p>
                <p className="text-muted-foreground text-sm/6">
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
