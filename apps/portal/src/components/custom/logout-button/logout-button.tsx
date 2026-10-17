'use client';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { apiHeaders, logoutApiUrl } from '@/lib/api';

export function LogoutButton() {
  const router = useRouter();
  const handleLogout = async () => {
    try {
      const res = await fetch(logoutApiUrl(), {
        method: 'POST',
        credentials: 'include',
        headers: apiHeaders(),
      });
      if (!res.ok) {
        throw new Error('Logout failed');
      }
      toast.success('Logged out successfully');
      router.push('/');
    } catch (error) {
      toast.error('Logout failed');
      console.error('Logout failed:', error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="text-muted-foreground hover:text-destructive flex items-center gap-2 text-sm font-medium transition"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );
}
