'use client';

import { Button } from '@scs/ui/components/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  fallbackHref: string;
  label: string;
  preferFallback?: boolean;
  variant?:
    'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?:
    'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
  className?: string;
}

export function BackButton({
  fallbackHref,
  label,
  preferFallback = false,
  variant = 'ghost',
  size = 'sm',
  className,
}: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (typeof window === 'undefined') return;

    if (preferFallback) {
      router.replace(fallbackHref);
      return;
    }

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.replace(fallbackHref);
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleBack}
      type="button"
      className={className}
    >
      <ArrowLeft className="mr-1 size-4" />
      {label}
    </Button>
  );
}
