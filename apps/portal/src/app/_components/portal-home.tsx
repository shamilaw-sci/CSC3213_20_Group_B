'use client';

import { buttonVariants } from '@scs/ui/components/button';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { UopLogoIcon } from '@/components/icons/uop-logo';
import { auth_error_messages } from '@/lib/auth/auth-errors';
import { authClient } from '@/lib/auth-client';

export default function PortalHome() {
  const { data: session, isPending } = authClient.useSession();
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

      {!isPending ? (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={session?.user ? '/dashboard' : '/login'}
            className={buttonVariants({ size: 'lg' })}
          >
            {session?.user ? 'Open dashboard' : 'Sign in'}
          </Link>

          {!isPending && !session?.user ? (
            <Link
              href="/signup"
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              Create account
            </Link>
          ) : null}
        </div>
      ) : null}

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
