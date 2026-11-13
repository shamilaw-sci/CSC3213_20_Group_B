'use client';

import {
  ACCESS_LEVEL,
  APP_ROLE,
  CurrentUserResponseSchema,
} from '@scs/schemas';
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
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { DashboardLoading } from '@/components/feedback/page-loading';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { apiHeaders, meApiUrl } from '@/lib/api';
import {
  canEditCoursesRole,
  getUserAccessLevel,
  getUserRole,
  isSuperAdminRole,
} from '@/types/role';

export default function Dashboard() {
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canManageHonours, setCanManageHonours] = useState(false);
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
        router.replace('/logout');
        return;
      }

      const user = await res.json().catch(() => null);
      if (!user) {
        router.replace('/?error=fetch_failed');
        return;
      }

      const hasProxySettings =
        getUserRole(user) !== APP_ROLE.USER ||
        getUserAccessLevel(user) !== ACCESS_LEVEL.NONE;

      if (mounted) {
        setIsSuperAdmin(isSuperAdminRole(user));
        const parsedUser = CurrentUserResponseSchema.safeParse(user);
        setCanManageHonours(
          parsedUser.success &&
            (parsedUser.data.accessLevel === ACCESS_LEVEL.ADMIN ||
              (parsedUser.data.role === APP_ROLE.ACADEMIC &&
                (parsedUser.data.honoursDepartments?.length ?? 0) > 0))
        );
        setShowCourses(canEditCoursesRole(user));
        setShowProxySettings(hasProxySettings);
        setLoaded(true);
      }
    }

    loadDashboard().catch(() => {
      router.replace('/?error=fetch_failed');
    });

    return () => {
      mounted = false;
    };
  }, [router]);

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

    if (isSuperAdmin || canManageHonours) {
      baseItems.unshift({
        title: 'Admin',
        href: '/admin',
        description: isSuperAdmin
          ? 'Open admin tools for users and personal-site redirects.'
          : 'Manage Honours programmes in your authorised departments.',
        icon: ShieldCheck,
      });
    }

    if (showProxySettings) {
      baseItems.push({
        title: 'Personal Site Redirect',
        href: '/user/proxy',
        description: 'Configure where your /~username address redirects.',
        icon: Network,
      });
    }

    return baseItems;
  }, [isSuperAdmin, canManageHonours, showCourses, showProxySettings]);

  if (!loaded) return <DashboardLoading />;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Dashboard"
        description="Quick access to portal tools and account areas."
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
