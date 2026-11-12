import type {
  MutationCoordinatorNamespace,
  OperationQueue,
  OperationStateNamespace,
} from '@/operations/cloudflare.types';
import type { OperationStore } from '@/operations/operation.store';
import type { OperationExecutor } from '@/operations/operation.executor';
import type { MutationCoordinator } from '@/operations/mutation-coordinator';

export interface GithubAppEnv {
  GITHUB_APP_ID: string;
  GITHUB_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_OWNER: string;
  GITHUB_PEOPLE_DATA_REPOSITORY: string;
  GITHUB_PROJECTS_DATA_REPOSITORY: string;
  X_INTERNAL_SECRET: string;
  PORT?: number | string;
  OPERATION_STATE?: OperationStateNamespace;
  MUTATION_COORDINATOR?: MutationCoordinatorNamespace;
  OPERATION_QUEUE?: OperationQueue;
  OPERATION_STORE?: OperationStore;
  OPERATION_EXECUTOR?: OperationExecutor;
  OPERATION_COORDINATOR?: MutationCoordinator;
}

export interface GithubAppRuntimeConfig extends Omit<
  GithubAppEnv,
  'PORT' | 'OPERATION_STATE' | 'MUTATION_COORDINATOR' | 'OPERATION_QUEUE'
> {
  PORT: number;
}
