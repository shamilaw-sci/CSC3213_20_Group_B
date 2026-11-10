/** Queues an already persisted operation ID for asynchronous execution. */
export interface OperationDispatcher {
  dispatch(operationId: string): Promise<void>;
}
