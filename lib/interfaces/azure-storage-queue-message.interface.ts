export interface AzureStorageQueueMessage<T = string> {
  id: string;
  body: T;
  dequeueCount: number;
  insertedOn: Date;
  expiresOn: Date;
}
