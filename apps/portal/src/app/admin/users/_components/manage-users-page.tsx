'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@scs/ui/components/avatar';
import { Badge } from '@scs/ui/components/badge';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { Input } from '@scs/ui/components/input';
import { Separator } from '@scs/ui/components/separator';
import { Search, Shield, UserCheck, Users, UserX } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import { Pagination } from '@/components/navigation/pagination';
import { emailPathSegment } from '@/lib/email';
import {
  ACCESS_LEVEL,
  ACCESS_LEVEL_LABEL,
  ACCESS_LEVELS,
  APP_ROLES,
  getUserAccessLevel,
  getUserRole,
  isSuperAdminRole,
  ROLE_LABEL,
} from '@/types/role';
import type { AdminUserData } from '@/types/user';

interface ManageUsersPageProps {
  users: AdminUserData[];
  previousHref?: string;
  nextHref?: string;
}

type FilterStatus = 'all' | 'active' | 'blacklisted' | 'has-access';

export default function ManageUsersPage({
  users,
  previousHref,
  nextHref,
}: ManageUsersPageProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');

  const stats = useMemo(() => {
    const roleCounts = Object.fromEntries(
      APP_ROLES.map((role) => [role, 0])
    ) as Record<(typeof APP_ROLES)[number], number>;
    const accessLevelCounts = Object.fromEntries(
      ACCESS_LEVELS.map((accessLevel) => [accessLevel, 0])
    ) as Record<(typeof ACCESS_LEVELS)[number], number>;

    for (const user of users) {
      roleCounts[getUserRole(user)] += 1;
      accessLevelCounts[getUserAccessLevel(user)] += 1;
    }

    return {
      total: users.length,
      active: users.filter((u) => !u.blacklisted).length,
      blacklisted: users.filter((u) => u.blacklisted).length,
      roleCounts,
      accessLevelCounts,
    };
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        search.trim() === '' ||
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        ROLE_LABEL[getUserRole(user)]
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && !user.blacklisted) ||
        (filter === 'blacklisted' && user.blacklisted) ||
        (filter === 'has-access' &&
          getUserAccessLevel(user) !== ACCESS_LEVEL.NONE);

      return matchesSearch && matchesFilter;
    });
  }, [users, search, filter]);

  return (
    <PageShell width="wide">
      <BackButton fallbackHref="/admin" label="Back to Admin" preferFallback />

      <PageHeader
        title="Manage Users"
        description="View and manage registered user accounts one bounded page at a time."
        icon={<Users className="text-muted-foreground size-6" />}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="bg-primary/10 flex size-9 items-center justify-center rounded-md">
              <Users className="text-primary size-5" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex size-9 items-center justify-center rounded-md bg-green-100 dark:bg-green-900/30">
              <UserCheck className="size-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Active</p>
              <p className="text-xl font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex size-9 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
              <UserX className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Blacklisted</p>
              <p className="text-xl font-bold">{stats.blacklisted}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Role Counts</CardTitle>
            <CardDescription>Person role distribution.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {APP_ROLES.map((role) => (
              <div key={role} className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">
                  {ROLE_LABEL[role]}
                </p>
                <p className="text-xl font-bold">{stats.roleCounts[role]}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Access Level Counts</CardTitle>
            <CardDescription>
              Management permission distribution.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ACCESS_LEVELS.filter(
              (accessLevel) => accessLevel !== ACCESS_LEVEL.NONE
            ).map((accessLevel) => (
              <div key={accessLevel} className="rounded-md border p-3">
                <div className="flex items-center gap-1.5">
                  <Shield className="text-muted-foreground size-3.5" />
                  <p className="text-muted-foreground text-xs">
                    {ACCESS_LEVEL_LABEL[accessLevel]}
                  </p>
                </div>
                <p className="text-xl font-bold">
                  {stats.accessLevelCounts[accessLevel]}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Search and filter users by name, email, role, or status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { label: 'All', value: 'all' },
                  { label: 'Active', value: 'active' },
                  { label: 'Blacklisted', value: 'blacklisted' },
                  { label: 'Has Access', value: 'has-access' },
                ] as { label: string; value: FilterStatus }[]
              ).map(({ label, value }) => (
                <Button
                  key={value}
                  variant={filter === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {filtered.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center">
              <Users className="size-10 opacity-30" />
              <p className="text-sm">No users found matching your criteria.</p>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {filtered.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <Avatar className="size-10 shrink-0">
                    <AvatarImage src={user.picture} alt={user.name} />
                    <AvatarFallback>
                      {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{user.name}</span>
                      <Badge variant="secondary">
                        {ROLE_LABEL[getUserRole(user)]}
                      </Badge>
                      {getUserAccessLevel(user) !== ACCESS_LEVEL.NONE ? (
                        <Badge variant="secondary">
                          {isSuperAdminRole(user) && (
                            <Shield className="mr-0.5 size-3" />
                          )}
                          {ACCESS_LEVEL_LABEL[getUserAccessLevel(user)]}
                        </Badge>
                      ) : null}
                      {user.blacklisted ? (
                        <Badge
                          variant="outline"
                          className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                        >
                          Blacklisted
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
                        >
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-sm">
                      {user.email}
                    </p>
                    {user.createdAt != null && (
                      <p className="text-muted-foreground text-xs">
                        Joined{' '}
                        {new Date(user.createdAt).toLocaleDateString(
                          undefined,
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/admin/users/${emailPathSegment(user.email)}`}
                      >
                        View
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/admin/users/${emailPathSegment(user.email)}/edit`}
                      >
                        Edit
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {filtered.length > 0 && (
            <p className="text-muted-foreground text-right text-xs">
              Showing {filtered.length} of {users.length} users on this page
            </p>
          )}
        </CardContent>
      </Card>

      <Pagination previousHref={previousHref} nextHref={nextHref} />
    </PageShell>
  );
}
