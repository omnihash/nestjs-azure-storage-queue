export interface AzureStorageQueuePollingOptions<T = string> {
  queueName: string;
  messageBodyType: T;
  pollingInterval?: number;
  visibilityTimeout?: number;
  maxDequeueCount?: number;
  maxMessages?: number;
}
