import worker from '@/index';
import type { Env } from '@/types/env';

import { createTestEnv } from 'test/helpers/create-test-env';

const TEST_ORIGIN = 'https://api.test.scs-pdn.space';

function createExecutionContext(): ExecutionContext {
  return {
    waitUntil(): void {},
    passThroughOnException(): void {},
    props: undefined,
  } as unknown as ExecutionContext;
}

export function invokeWorker(
  path: string,
  init: RequestInit = {},
  env: Env = createTestEnv()
): Promise<Response> {
  const request = new Request(new URL(path, TEST_ORIGIN), init);
  return worker.fetch(request, env, createExecutionContext());
}
