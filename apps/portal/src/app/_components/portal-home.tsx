'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { UopLogoIcon } from '@/components/icons/uop-logo';
import { auth_error_messages } from '@/lib/auth/auth-errors';

export default function PortalHome() {
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
    <section
      className="bg-muted/45 flex min-h-[calc(100svh-7rem)] flex-col
        items-center justify-center px-6 py-12 text-center"
    >
      <div className="mb-6 flex flex-col items-center gap-3">
        <UopLogoIcon className="size-24" />
        <h1 className="text-foreground text-4xl font-semibold">
          SCS PDN Portal
        </h1>
      </div>

      <p className="text-foreground mt-4 text-2xl font-semibold">
        Department of Statistics &amp; Computer Science
      </p>

      <p className="text-muted-foreground text-lg font-medium">
        Faculty of Science, University of Peradeniya
      </p>

      <p className="text-muted-foreground mt-6 max-w-xl text-sm/6">
        This portal provides access to academic and administrative services for
        students, staff, and administrators of the Department of Statistics and
        Computer Science.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/login"
          className="bg-primary text-primary-foreground hover:bg-primary/90
            inline-flex min-h-11 items-center rounded-md px-5 text-sm
            font-medium focus-visible:outline-none"
        >
          Sign in
        </Link>

        <Link
          href="/signup"
          className="bg-background hover:bg-accent inline-flex min-h-11
            items-center rounded-md border px-5 text-sm font-medium
            focus-visible:outline-none"
        >
          Create account
        </Link>
      </div>

      <div className="text-muted-foreground mt-8 flex gap-4 text-sm">
        <Link href="/privacy" className="hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/tos" className="hover:text-foreground">
          Terms of Service
        </Link>
      </div>
    </section>
  );
}
