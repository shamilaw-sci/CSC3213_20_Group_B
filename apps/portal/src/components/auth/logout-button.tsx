'use client';

import { Button } from '@scs/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@scs/ui/components/dialog';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { authClient } from '@/lib/auth-client';

export function LogoutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message ?? 'Logout failed');

      setOpen(false);
      toast.success('Logged out successfully');
      router.push('/login');
      router.refresh();
    } catch (error) {
      toast.error('Logout failed');
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <LogOut data-icon="inline-start" aria-hidden="true" />
          Log out
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log out?</DialogTitle>
          <DialogDescription>
            You will need to sign in again to access your portal workspace.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isLoggingOut}>
              Stay signed in
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isLoggingOut}
            onClick={handleLogout}
          >
            {isLoggingOut ? 'Logging out…' : 'Log out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
