'use client';

import { Button } from '@scs/ui/components/button';
import { Input } from '@scs/ui/components/input';
import { Label } from '@scs/ui/components/label';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { MagicCodeInput } from '@/components/auth/magic-code-input';
import { authConfig } from '@/config/auth.config';
import { auth_error_messages } from '@/lib/auth/auth-errors';
import { authClient } from '@/lib/auth-client';

type Step = 'idle' | 'sending' | 'verify' | 'verifying';

interface MagicCodeFormProps {
  onBack: () => void;
}

export function MagicCodeForm({ onBack }: MagicCodeFormProps) {
  const [step, setStep] = useState<Step>('idle');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState('');
  const [canResend, setCanResend] = useState(true);

  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  useEffect(() => {
    if (expiresAt === null) return;

    function tick() {
      const remaining = Math.max(
        0,
        Math.floor((expiresAt! - Date.now()) / 1000)
      );
      if (remaining <= 0) {
        setCountdown('');
        setExpiresAt(null);
        return;
      }
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    }

    tick();
    countdownIntervalRef.current = setInterval(tick, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [expiresAt]);

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
    };
  }, []);

  function isValidEmailDomain(e: string): boolean {
    return /@(pdn\.ac\.lk|sci\.pdn\.ac\.lk)$/.test(e.trim());
  }

  function maskEmail(e: string): string {
    const [local, domain] = e.split('@');
    if (!local || !domain) return e;
    const masked =
      local.length <= 2
        ? local[0] + '*'.repeat(local.length - 1)
        : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
    return `${masked}@${domain}`;
  }

  async function sendCode() {
    const e = email.trim().toLowerCase();
    if (!e) {
      setEmailError('Please enter your email address.');
      return;
    }
    if (!isValidEmailDomain(e)) {
      setEmailError('Use your @pdn.ac.lk or @sci.pdn.ac.lk email.');
      return;
    }
    if (!canResend) return;

    setEmailError('');
    setStep('sending');
    setCanResend(false);

    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: e,
        type: 'sign-in',
      });

      if (error) {
        const message =
          error.code === 'university_email_required'
            ? 'Use your @pdn.ac.lk or @sci.pdn.ac.lk email.'
            : auth_error_messages[error.code ?? ''] ||
              error.message ||
              'Unable to send a verification code.';
        setEmailError(message);
        setStep('idle');
        setCanResend(true);
        return;
      }

      setStep('verify');
      setExpiresAt(
        Date.now() + authConfig.magicCode.fallbackExpiresInSeconds * 1000
      );
      localStorage.setItem('lastUsedAuth', 'email');

      resendTimerRef.current = setTimeout(
        () => setCanResend(true),
        authConfig.magicCode.resendCooldownMs
      );
    } catch {
      toast.error('Network error. Please check your connection.');
      setStep('idle');
      setCanResend(true);
    }
  }

  const handleCodeComplete = useCallback(
    async (code: string) => {
      setCodeError('');
      setStep('verifying');

      try {
        const { error } = await authClient.signIn.emailOtp({
          email: email.trim().toLowerCase(),
          otp: code,
        });

        if (error) {
          const message =
            auth_error_messages[error.code ?? ''] ||
            error.message ||
            'Verification failed.';
          setCodeError(message);
          setStep('verify');
          return;
        }

        window.location.href = '/dashboard';
      } catch {
        toast.error('Network error. Please check your connection.');
        setStep('verify');
      }
    },
    [email]
  );

  function handleResend() {
    setStep('idle');
    setCodeError('');
    setEmailError('');
    setExpiresAt(null);
  }

  if (step === 'verify' || step === 'verifying') {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm text-center">
          A verification code was sent to <strong>{maskEmail(email)}</strong>.
        </p>

        {countdown ? (
          <p className="text-muted-foreground text-xs text-center">
            Code expires in{' '}
            <span className="font-semibold tabular-nums">{countdown}</span>
          </p>
        ) : expiresAt === null && step === 'verify' ? null : (
          <p className="text-destructive text-xs text-center">
            Code expired. Request a new one.
          </p>
        )}

        <MagicCodeInput
          length={authConfig.magicCode.length}
          disabled={step === 'verifying'}
          error={!!codeError}
          onComplete={handleCodeComplete}
        />

        {codeError && (
          <p className="text-destructive text-sm text-center">{codeError}</p>
        )}

        {step === 'verifying' && (
          <p className="text-muted-foreground text-sm text-center">
            Verifying…
          </p>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setStep('idle');
              setCodeError('');
              setEmailError('');
              setExpiresAt(null);
            }}
            disabled={step === 'verifying'}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={handleResend}
            disabled={step === 'verifying' || !canResend}
            className="flex-1 text-sm"
          >
            Resend Code
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="email-input">Email Address</Label>
        <Input
          id="email-input"
          type="email"
          placeholder="you@pdn.ac.lk"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError('');
          }}
          disabled={step === 'sending'}
          autoComplete="email"
        />
      </div>
      {emailError && <p className="text-destructive text-sm">{emailError}</p>}
      <div className="flex gap-2">
        <Button
          variant="outline"
          type="button"
          onClick={onBack}
          disabled={step === 'sending'}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={sendCode}
          disabled={step === 'sending' || !canResend}
          className="flex-1"
        >
          {step === 'sending' ? 'Sending code…' : 'Send Code'}
        </Button>
      </div>
    </div>
  );
}
