const requestContexts = new WeakMap<Request, ExecutionContext>();
const backgroundHandlers = new WeakMap<
  Request,
  (promise: Promise<unknown>) => void
>();

export function bindExecutionContext(
  request: Request,
  context: ExecutionContext
): void {
  requestContexts.set(request, context);
}

export function bindBackgroundTaskHandler(
  request: Request,
  handler: (promise: Promise<unknown>) => void
): void {
  backgroundHandlers.set(request, handler);
}

export function waitUntil(request: Request, promise: Promise<unknown>): void {
  const backgroundHandler = backgroundHandlers.get(request);
  if (backgroundHandler) {
    backgroundHandler(promise);
    return;
  }
  const context = requestContexts.get(request);
  if (context) {
    context.waitUntil(promise);
    return;
  }

  void promise.catch((error: unknown) => {
    console.error('Background auth task failed:', error);
  });
}
