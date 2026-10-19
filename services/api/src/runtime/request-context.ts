const requestContexts = new WeakMap<Request, ExecutionContext>();

export function bindExecutionContext(
  request: Request,
  context: ExecutionContext
): void {
  requestContexts.set(request, context);
}

export function waitUntil(request: Request, promise: Promise<unknown>): void {
  const context = requestContexts.get(request);
  if (context) {
    context.waitUntil(promise);
    return;
  }

  void promise.catch((error: unknown) => {
    console.error('Background auth task failed:', error);
  });
}
