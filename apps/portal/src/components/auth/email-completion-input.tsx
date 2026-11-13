'use client';

import { STUDENT_EMAIL_DOMAIN } from '@scs/schemas';
import { Input } from '@scs/ui/components/input';
import { useState } from 'react';

import { emailCompletion, isStudentLocalPart } from '@/lib/email-completion';

interface EmailCompletionInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

export function EmailCompletionInput({
  value,
  onChange,
  disabled,
}: EmailCompletionInputProps) {
  const [focused, setFocused] = useState(false);
  const [caretAtEnd, setCaretAtEnd] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [composing, setComposing] = useState(false);
  const suffix =
    focused && caretAtEnd && !dismissed && !composing
      ? emailCompletion(value)
      : '';

  function syncCaret(input: HTMLInputElement) {
    setCaretAtEnd(
      input.selectionStart === input.value.length &&
        input.selectionEnd === input.value.length
    );
    setScrollLeft(input.scrollLeft);
  }

  function commit(input: HTMLInputElement) {
    const completion = emailCompletion(input.value);
    if (!completion) return;
    const completed = input.value + completion;
    // Keep the DOM value in sync for a Tab key immediately followed by blur.
    input.value = completed;
    onChange(completed);
    setDismissed(false);
    setCaretAtEnd(true);
  }

  return (
    <div className="relative min-w-0">
      <Input
        id="email-input"
        type="text"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="you@pdn.ac.lk"
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.value);
          setDismissed(false);
          syncCaret(event.currentTarget);
        }}
        onFocus={(event) => {
          setFocused(true);
          syncCaret(event.currentTarget);
        }}
        onSelect={(event) => syncCaret(event.currentTarget)}
        onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(event) => {
          setComposing(false);
          syncCaret(event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || composing) return;
          if (event.key === 'Escape') {
            setDismissed(true);
          } else if (
            (event.key === 'Tab' || event.key === 'ArrowRight') &&
            suffix &&
            event.currentTarget.selectionStart ===
              event.currentTarget.value.length &&
            event.currentTarget.selectionEnd ===
              event.currentTarget.value.length
          ) {
            commit(event.currentTarget);
            if (event.key === 'ArrowRight') event.preventDefault();
          }
        }}
        onBlur={(event) => {
          setFocused(false);
          if (isStudentLocalPart(event.currentTarget.value)) {
            onChange(`${event.currentTarget.value}@${STUDENT_EMAIL_DOMAIN}`);
          }
        }}
        disabled={disabled}
        autoComplete="email"
        spellCheck={false}
      />
      {suffix && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden
            rounded-md"
        >
          <div
            className="flex h-full w-max items-center px-3 text-base
              whitespace-pre md:text-sm"
            style={{ transform: `translateX(-${scrollLeft}px)` }}
          >
            <span className="text-transparent">{value}</span>
            <span className="text-muted-foreground">{suffix}</span>
          </div>
        </div>
      )}
    </div>
  );
}
