'use client';

import { Button } from '@scs/ui/components/button';
import { Input } from '@scs/ui/components/input';
import { Label } from '@scs/ui/components/label';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { MagicCodeInput } from '@/components/custom/magic-code-input/magic-code-input';
import { authConfig } from '@/config/auth.config';
import { requestMagicCode, verifyMagicCode } from '@/lib/api';
import { auth_error_messages } from '@/views/auth/auth-errors';

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

  // --- Countdown timer ---
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // --- Helpers ---
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

  // --- Send magic code ---
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
      const data = await requestMagicCode(e);

      if (data.error) {
        const message =
          data.error === 'Unauthorized email domain'
            ? 'Use your @pdn.ac.lk or @sci.pdn.ac.lk email.'
            : auth_error_messages[data.error] || data.error;
        setEmailError(message);
        setStep('idle');
        setCanResend(true);
        return;
      }

      setStep('verify');
      setExpiresAt(
        Date.now() +
          (data.expiresIn ?? authConfig.magicCode.fallbackExpiresInSeconds) *
            1000
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

  // --- Verify magic code ---
  const handleCodeComplete = useCallback(
    async (code: string) => {
      setCodeError('');
      setStep('verifying');

      try {
        const result = await verifyMagicCode(email.trim(), code);

        if (result.redirectTo) {
          window.location.href = result.redirectTo;
          return;
        }

        if (result.error) {
          const message =
            auth_error_messages[result.error] ||
            result.error ||
            'Verification failed.';
          setCodeError(message);
          setStep('verify');
          return;
        }

        // Neither redirectTo nor error — something went wrong upstream
        toast.error('Verification failed. Please try again.');
        setStep('verify');
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

  // --- Step 2: Code input ---
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

  // --- Step 1: Email input ---
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
