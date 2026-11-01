import { Avatar, AvatarFallback, AvatarImage } from '@scs/ui/components/avatar';
import { Badge } from '@scs/ui/components/badge';
import { buttonVariants } from '@scs/ui/components/button';
import { Card, CardContent } from '@scs/ui/components/card';
import { IdCard, Mail, Pencil, Settings } from 'lucide-react';
import Link from 'next/link';

import type { AppRole } from '@/types/role';
import { getUserRole, ROLE_LABEL } from '@/types/role';

export interface ProfileHeaderProps {
  picture: string;
  name: string;
  email: string;
  role: AppRole;
  editHref: string;
  publicProfileHref: string;
  settingsHref: string;
}

export default function ProfileHeader({
  picture,
  name,
  email,
  role,
  editHref,
  publicProfileHref,
  settingsHref,
}: ProfileHeaderProps) {
  const resolvedRole = getUserRole({ role });

  return (
    <Card>
      <CardContent className="p-6">
        <div
          className="flex flex-col items-start gap-6 md:flex-row
            md:items-center"
        >
          <div className="relative">
            <Avatar className="size-24">
              <AvatarImage src={picture} alt="Profile" />
              <AvatarFallback className="text-2xl">
                {name ? name.charAt(0).toUpperCase() : '?'}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <h1 className="text-2xl font-semibold">{name}</h1>
              <Badge variant="secondary">{ROLE_LABEL[resolvedRole]}</Badge>
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Mail className="size-4" />
                {email}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={publicProfileHref}
              className={buttonVariants({ variant: 'outline' })}
            >
              <IdCard className="size-4" />
              Public Profile
            </Link>
            <Link
              href={settingsHref}
              className={buttonVariants({ variant: 'default' })}
            >
              <Settings className="size-4" />
              Open Settings
            </Link>
            <Link
              href={editHref}
              className={buttonVariants({ variant: 'outline' })}
            >
              <Pencil className="size-4" />
              Edit Profile
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
