'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { LoginForm } from '@/components/custom/login-form/login-form';
import { UopLogoIcon } from '@/components/icons/uop-logo';
import { auth_error_messages } from '@/lib/auth/auth-errors';

export default function Login() {
  const params = useSearchParams();
  const error = params.get('error');
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!error) return;

    toast.error(auth_error_messages[error] || 'Login failed', {
      onDismiss: () => router.replace(pathname),
    });
  }, [error, pathname, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="mb-2 flex flex-col items-center gap-3">
          <UopLogoIcon className="h-24 w-24" />
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">
              SCS PDN Portal
            </h1>
          </div>
        </div>
        <LoginForm />
        <div className="flex justify-center gap-4 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/tos" className="hover:text-foreground">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
