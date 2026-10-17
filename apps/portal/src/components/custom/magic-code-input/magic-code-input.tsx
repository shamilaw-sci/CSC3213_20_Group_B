'use client';

import {
  type ClipboardEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/utils';

interface MagicCodeInputProps {
  length?: number;
  disabled?: boolean;
  error?: boolean;
  onComplete: (code: string) => void;
  className?: string;
}

export function MagicCodeInput({
  length = 6,
  disabled = false,
  error = false,
  onComplete,
  className,
}: MagicCodeInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function focusNext(index: number) {
    const next = inputRefs.current[index + 1];
    if (next) {
      next.focus();
      next.select();
    }
  }

  function focusPrev(index: number) {
    const prev = inputRefs.current[index - 1];
    if (prev) {
      prev.focus();
      prev.select();
    }
  }

  function handleChange(index: number, value: string) {
    // Accept only single digits
    const cleaned = value.replace(/\D/g, '').slice(-1);
    if (!cleaned) return;

    const newDigits = [...digits];
    newDigits[index] = cleaned;
    setDigits(newDigits);

    // Check if all digits are filled
    const code = newDigits.join('');
    if (code.length === length) {
      onComplete(code);
    } else {
      focusNext(index);
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        // Clear current digit
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      } else {
        // Move to previous input and clear it
        focusPrev(index);
        if (index > 0) {
          const newDigits = [...digits];
          newDigits[index - 1] = '';
          setDigits(newDigits);
        }
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusPrev(index);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusNext(index);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, length);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      if (i < length) newDigits[i] = pasted[i];
    }
    setDigits(newDigits);

    // Focus the appropriate input
    const focusIdx = Math.min(pasted.length, length - 1);
    inputRefs.current[focusIdx]?.focus();

    // Auto-submit if all filled
    if (pasted.length === length) {
      onComplete(pasted);
    }
  }

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          className={cn(
            'h-12 w-10 rounded-md border text-center text-lg font-semibold shadow-sm transition-colors',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            error &&
              !disabled &&
              'border-destructive focus:border-destructive focus:ring-destructive/20',
            disabled && 'cursor-not-allowed opacity-50',
            !error && !disabled && 'border-input'
          )}
        />
      ))}
    </div>
  );
}
