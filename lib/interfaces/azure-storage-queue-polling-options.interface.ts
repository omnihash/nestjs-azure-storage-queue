export interface AzureStorageQueuePollingOptions {
  queueName: string;
  pollingInterval?: number;
  visibilityTimeout?: number;
  maxDequeueCount?: number;
  maxMessages?: number;
}
