import type { MutationCoordinatorNamespace } from '@/operations/cloudflare.types';

export interface MutationCoordinator {
  runExclusive<T>(
    resourceKey: string,
    operationId: string,
    task: () => Promise<T>
  ): Promise<T>;
}

export class InMemoryMutationCoordinator implements MutationCoordinator {
  private readonly tails = new Map<string, Promise<void>>();

  async runExclusive<T>(
    resourceKey: string,
    _operationId: string,
    task: () => Promise<T>
  ): Promise<T> {
    const previous = this.tails.get(resourceKey) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.tails.set(resourceKey, tail);

    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.tails.get(resourceKey) === tail) this.tails.delete(resourceKey);
    }
  }
}

export const localMutationCoordinator = new InMemoryMutationCoordinator();

export class MutationResourceBusyError extends Error {
  constructor(public readonly resourceKey: string) {
    super(`Resource ${resourceKey} is being mutated by another operation`);
    this.name = 'MutationResourceBusyError';
  }
}

export class CloudflareMutationCoordinator implements MutationCoordinator {
  constructor(
    private readonly namespace: MutationCoordinatorNamespace,
    private readonly leaseMs = 300_000
  ) {}

  async runExclusive<T>(
    resourceKey: string,
    operationId: string,
    task: () => Promise<T>
  ): Promise<T> {
    const stub = this.namespace.getByName(resourceKey);
    if (!(await stub.acquire(operationId, this.leaseMs))) {
      throw new MutationResourceBusyError(resourceKey);
    }

    try {
      return await task();
    } finally {
      await stub.release(operationId);
    }
  }
}
