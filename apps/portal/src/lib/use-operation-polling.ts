'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useOperationPollingSignal(): () => AbortSignal {
  const activeController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => activeController.current?.abort();
  }, []);

  return useCallback(() => {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    return controller.signal;
  }, []);
}
