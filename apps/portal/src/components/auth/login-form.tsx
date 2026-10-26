'use client';
import { Button } from '@scs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@scs/ui/components/card';
import { Field, FieldDescription, FieldGroup } from '@scs/ui/components/field';
import { Separator } from '@scs/ui/components/separator';
import { cn } from 'cn';
import { Fingerprint, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { MagicCodeForm } from '@/components/auth/magic-code-form';
import publicEnvConfig from '@/config/public.env.config';
import { auth_error_messages } from '@/lib/auth/auth-errors';
import { authClient } from '@/lib/auth-client';
import {
  authenticateWithPasskey,
  isPasskeyApiError,
  passkeysAreSupported,
} from '@/lib/passkeys';

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [lastUsedAuth, setLastUsedAuth] = useState(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('lastUsedAuth');
  });

  const [showEmailForm, setShowEmailForm] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPasskeySupported(passkeysAreSupported());
  }, []);

  async function login(
    provider: 'google' | 'github',
    prompt?: 'consent' | 'select_account'
  ) {
    setLoading(true);

    try {
      const lastUsed =
        provider === 'google'
          ? prompt === 'select_account'
            ? 'another-google'
            : 'google'
          : 'github';
      localStorage.setItem('lastUsedAuth', lastUsed);
      setLastUsedAuth(lastUsed);

      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: new URL(
          '/dashboard',
          publicEnvConfig.NEXT_PUBLIC_SITE_URL
        ).toString(),
        errorCallbackURL: new URL(
          '/login',
          publicEnvConfig.NEXT_PUBLIC_SITE_URL
        ).toString(),
        ...(provider === 'google' && prompt
          ? { additionalParams: { prompt } }
          : {}),
      });
      if (error) throw new Error(error.message ?? 'Login failed');
    } catch (err) {
      console.error(err);
      toast.error('Login failed. Please try again.');
    }

    setLoading(false);
  }

  async function loginWithPasskey() {
    if (!passkeySupported || passkeyLoading) return;

    setPasskeyLoading(true);

    try {
      const result = await authenticateWithPasskey();
      localStorage.setItem('lastUsedAuth', 'passkey');
      setLastUsedAuth('passkey');
      router.replace(result.redirectTo ?? '/dashboard');
      router.refresh();
    } catch (error) {
      if (isPasskeyApiError(error)) {
        if (error.status === 401) {
          router.replace('/logout');
          return;
        }

        if (error.status === 404) {
          toast.error(auth_error_messages.passkey_no_credentials);
          setPasskeyLoading(false);
          return;
        }

        if (error.status === 403) {
          toast.error(auth_error_messages.passkey_not_allowed);
          setPasskeyLoading(false);
          return;
        }

        if (error.status === 400) {
          toast.error(error.message || auth_error_messages.passkey_bad_request);
          setPasskeyLoading(false);
          return;
        }

        toast.error(error.message || 'Passkey login failed. Please try again.');
        setPasskeyLoading(false);
        return;
      }

      const domEx = error as DOMException | undefined;
      if (domEx && domEx.name === 'NotAllowedError') {
        toast.error(auth_error_messages.passkey_cancelled);
        setPasskeyLoading(false);
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : 'Passkey login failed. Please try again.'
      );
    } finally {
      setPasskeyLoading(false);
    }
  }

  function openEmailForm() {
    setShowEmailForm(true);
  }

  function closeEmailForm() {
    setShowEmailForm(false);
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {showEmailForm ? 'Sign in with Email' : 'Welcome back'}
          </CardTitle>
          <CardDescription>
            {showEmailForm
              ? 'Enter your university email to receive a verification code'
              : 'Continue with passkey, Google, GitHub, or Email'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => e.preventDefault()}>
            <FieldGroup>
              {!showEmailForm ? (
                <>
                  <Field>
                    <Button
                      type="button"
                      onClick={loginWithPasskey}
                      disabled={!passkeySupported || passkeyLoading || loading}
                      className="relative"
                      title={
                        passkeySupported
                          ? undefined
                          : 'Passkeys are not supported in this browser.'
                      }
                    >
                      <Fingerprint />
                      {passkeyLoading ? 'Checking passkey...' : 'Use Passkey'}
                      {lastUsedAuth === 'passkey' && (
                        <span
                          className="bg-info text-info-foreground absolute
                            -top-2 right-3 rounded-full px-2 py-0.5 text-[10px]
                            font-medium shadow"
                        >
                          Last Used
                        </span>
                      )}
                    </Button>
                    <p className="text-muted-foreground text-center text-xs">
                      Your browser will show available passkeys to choose from.
                    </p>
                  </Field>
                  <div className="relative flex items-center py-1">
                    <Separator className="flex-1" />
                    <span className="bg-card text-muted-foreground px-2 text-xs">
                      or
                    </span>
                    <Separator className="flex-1" />
                  </div>
                  <Field>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => login('google')}
                      disabled={loading}
                      className="relative"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        width="24"
                        height="24"
                        style={{ opacity: 1 }}
                      >
                        <path
                          fill="#FFC107"
                          d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917"
                        />
                        <path
                          fill="#FF3D00"
                          d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691"
                        />
                        <path
                          fill="#4CAF50"
                          d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.9 11.9 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44"
                        />
                        <path
                          fill="#1976D2"
                          d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917"
                        />
                      </svg>
                      Continue with Google
                      {lastUsedAuth === 'google' && (
                        <span
                          className="bg-info text-info-foreground absolute
                            -top-2 right-3 rounded-full px-2 py-0.5 text-[10px]
                            font-medium shadow"
                        >
                          Last Used
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => login('google', 'select_account')}
                      disabled={loading}
                      className="relative"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        width="24"
                        height="24"
                        style={{ opacity: 1 }}
                      >
                        <path
                          fill="#FFC107"
                          d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917"
                        />
                        <path
                          fill="#FF3D00"
                          d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691"
                        />
                        <path
                          fill="#4CAF50"
                          d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.9 11.9 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44"
                        />
                        <path
                          fill="#1976D2"
                          d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917"
                        />
                      </svg>
                      Continue with Another Google Account
                      {lastUsedAuth === 'another-google' && (
                        <span
                          className="bg-info text-info-foreground absolute
                            -top-2 right-3 rounded-full px-2 py-0.5 text-[10px]
                            font-medium shadow"
                        >
                          Last Used
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => login('github')}
                      disabled={loading}
                      className="relative"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                          fill="currentColor"
                        />
                      </svg>
                      Continue with GitHub
                      {lastUsedAuth === 'github' && (
                        <span
                          className="bg-info text-info-foreground absolute
                            -top-2 right-3 rounded-full px-2 py-0.5 text-[10px]
                            font-medium shadow"
                        >
                          Last Used
                        </span>
                      )}
                    </Button>
                  </Field>
                  <div className="relative flex items-center py-1">
                    <Separator className="flex-1" />
                    <span className="bg-card text-muted-foreground px-2 text-xs">
                      or
                    </span>
                    <Separator className="flex-1" />
                  </div>
                  <Field>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={openEmailForm}
                      disabled={loading}
                      className="relative"
                    >
                      <Mail />
                      Continue with Email
                      {lastUsedAuth === 'email' && (
                        <span
                          className="bg-info text-info-foreground absolute
                            -top-2 right-3 rounded-full px-2 py-0.5 text-[10px]
                            font-medium shadow"
                        >
                          Last Used
                        </span>
                      )}
                    </Button>
                  </Field>
                </>
              ) : (
                <Field>
                  <MagicCodeForm onBack={closeEmailForm} />
                </Field>
              )}
              <Field>
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{' '}
                  <Link href="/signup">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
