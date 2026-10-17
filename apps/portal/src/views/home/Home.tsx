'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { UopLogoIcon } from '@/components/icons/uop-logo';
import { auth_error_messages } from '@/views/auth/auth-errors';

export default function Home() {
  const params = useSearchParams();
  const error = params.get('error');
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!error) return;

    toast.error(auth_error_messages[error] || 'Login failed', {
      onDismiss: () => router.replace(pathname),
    });
    router.replace('/login');
  }, [error, pathname, router]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted px-6 text-center">
      <div className="mb-6 flex flex-col items-center gap-3">
        <UopLogoIcon className="h-24 w-24" />
        <div className="text-center">
          <h1 className="text-4xl font-semibold text-foreground">
            SCS PDN Portal
          </h1>
        </div>
      </div>

      <p className="mt-4 text-2xl font-semibold text-foreground">
        Department of Statistics & Computer Science
      </p>

      <p className="text-muted-foreground text-lg font-medium">
        Faculty of Science, University of Peradeniya
      </p>

      <p className="text-muted-foreground mt-6 max-w-xl text-sm leading-6">
        This portal provides access to academic and administrative services for
        students, staff, and administrators of the Department of Statistics and
        Computer Science.
      </p>

      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Login
        </Link>

        <Link
          href="/signup"
          className="rounded-md border bg-background px-5 py-2.5 text-sm font-medium transition hover:bg-accent"
        >
          Sign Up
        </Link>
      </div>

      <div className="mt-8 flex gap-4 text-sm text-muted-foreground">
        <Link href="/privacy" className="hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/tos" className="hover:text-foreground">
          Terms of Service
        </Link>
      </div>
    </main>
  );
}
