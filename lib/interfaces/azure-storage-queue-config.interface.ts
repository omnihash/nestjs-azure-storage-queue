export interface AzureStorageQueueConfig {
  connectionString: string;
  defaultVisibilityTimeout?: number;
  defaultPollingInterval?: number;
  defaultMaxDequeueCount?: number;
}
