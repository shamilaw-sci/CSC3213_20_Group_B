import { Badge } from '@scs/ui/badge';
import { IdCard, Mail, Pencil, Settings } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <div className="relative">
            <Avatar className="h-24 w-24">
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
            <Button variant="outline" asChild>
              <Link href={publicProfileHref}>
                <IdCard className="size-4" />
                Public Profile
              </Link>
            </Button>
            <Button variant="default" asChild>
              <Link href={settingsHref}>
                <Settings className="size-4" />
                Open Settings
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={editHref}>
                <Pencil className="size-4" />
                Edit Profile
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
