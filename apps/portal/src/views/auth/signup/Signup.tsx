'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { SignupForm } from '@/components/custom/signup-form/signup-form';
import { UopLogoIcon } from '@/components/icons/uop-logo';
import { auth_error_messages } from '@/views/auth/auth-errors';

export default function Signup() {
  const params = useSearchParams();
  const error = params.get('error');
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!error) return;

    toast.error(auth_error_messages[error] || 'Signup failed', {
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
        <SignupForm />
      </div>
    </div>
  );
}
