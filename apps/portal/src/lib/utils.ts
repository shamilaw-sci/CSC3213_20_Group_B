import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts the username part from an email address (the part before @).
 * Returns the full string if it does not contain '@'.
 */
export function emailToUsername(email: string): string {
  return email.includes('@') ? email.split('@')[0] : email;
}

export function emailPathSegment(email: string): string {
  return encodeURIComponent(email).replaceAll('%40', '@');
}
