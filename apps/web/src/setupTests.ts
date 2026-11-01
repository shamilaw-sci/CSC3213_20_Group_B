import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined' && !window.PointerEvent) {
  window.PointerEvent = window.MouseEvent as typeof PointerEvent;
}
