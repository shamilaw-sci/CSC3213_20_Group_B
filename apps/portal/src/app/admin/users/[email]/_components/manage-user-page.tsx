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
import { Separator } from '@scs/ui/components/separator';
import { Calendar, IdCard, Mail, Shield, UserCheck, UserX } from 'lucide-react';
import Link from 'next/link';

import { PageShell } from '@/components/layout/page-shell';
import { BackButton } from '@/components/navigation/back-button';
import { emailPathSegment } from '@/lib/email';
import {
  ACCESS_LEVEL,
  ACCESS_LEVEL_LABEL,
  getUserAccessLevel,
  getUserRole,
  isSuperAdminRole,
  ROLE_LABEL,
} from '@/types/role';
import { AdminUserData } from '@/types/user';

interface ManageUserPageProps {
  user: AdminUserData;
}

export default function ManageUserPage({ user }: ManageUserPageProps) {
  const role = getUserRole(user);
  const accessLevel = getUserAccessLevel(user);
  const isSuperAdmin = isSuperAdminRole(user);

  return (
    <PageShell>
      <div className="flex items-center gap-2">
        <BackButton
          fallbackHref="/admin/users"
          label="Back to Users"
          preferFallback
        />
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.picture} alt={user.name} />
              <AvatarFallback className="text-2xl">
                {user.name ? user.name.charAt(0).toUpperCase() : '?'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{user.name}</h1>
                <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>
                {accessLevel !== ACCESS_LEVEL.NONE ? (
                  <Badge variant="secondary">
                    {isSuperAdmin && <Shield className="mr-0.5 size-3" />}
                    {ACCESS_LEVEL_LABEL[accessLevel]}
                  </Badge>
                ) : null}
                {user.blacklisted ? (
                  <Badge
                    variant="outline"
                    className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                  >
                    <UserX className="mr-0.5 size-3" />
                    Blacklisted
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
                  >
                    <UserCheck className="mr-0.5 size-3" />
                    Active
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Mail className="size-4" />
                  {user.email}
                </div>
                {user.createdAt != null && (
                  <div className="flex items-center gap-1">
                    <Calendar className="size-4" />
                    Joined{' '}
                    {new Date(user.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link
                  href={`/admin/users/${emailPathSegment(user.email)}/public-profile`}
                >
                  <IdCard className="size-4" />
                  Public Profile
                </Link>
              </Button>
              <Button variant="default" asChild>
                <Link
                  href={`/admin/users/${emailPathSegment(user.email)}/edit`}
                >
                  Edit User
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Overview of this user&apos;s account information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Account Status</p>
              <p className="text-muted-foreground text-sm">
                {user.blacklisted
                  ? 'This account is currently blacklisted'
                  : 'This account is currently active'}
              </p>
            </div>
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

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Role</p>
              <p className="text-muted-foreground text-sm">
                {ROLE_LABEL[role]} person role
              </p>
            </div>
            <Badge variant="outline">{ROLE_LABEL[role]}</Badge>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Access Level</p>
              <p className="text-muted-foreground text-sm">
                {accessLevel === ACCESS_LEVEL.NONE
                  ? 'No inherited admin access'
                  : `${ACCESS_LEVEL_LABEL[accessLevel]} management access`}
              </p>
            </div>
            <Badge
              variant={
                accessLevel === ACCESS_LEVEL.NONE ? 'outline' : 'secondary'
              }
            >
              {isSuperAdmin && <Shield className="mr-0.5 size-3" />}
              {ACCESS_LEVEL_LABEL[accessLevel]}
            </Badge>
          </div>

          {(user.googleOAuth || user.githubOAuth) && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">OAuth Providers</p>
                  <p className="text-muted-foreground text-sm">
                    {user.googleOAuth && user.githubOAuth
                      ? 'Google and GitHub accounts linked'
                      : user.googleOAuth
                        ? 'Google account linked'
                        : user.githubOAuth
                          ? 'GitHub account linked'
                          : 'No OAuth providers linked'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {user.googleOAuth && (
                    <Badge
                      variant="outline"
                      className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                    >
                      Google
                    </Badge>
                  )}
                  {user.githubOAuth && (
                    <Badge
                      variant="outline"
                      className="border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950/30 dark:text-gray-400"
                    >
                      GitHub
                    </Badge>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
