'use client';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { authClient } from '@/lib/auth-client';

export function LogoutButton() {
  const router = useRouter();
  const handleLogout = async () => {
    try {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message ?? 'Logout failed');
      toast.success('Logged out successfully');
      router.push('/login');
      router.refresh();
    } catch (error) {
      toast.error('Logout failed');
      console.error('Logout failed:', error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="text-muted-foreground hover:text-destructive flex items-center
        gap-2 text-sm font-medium transition"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );
}
