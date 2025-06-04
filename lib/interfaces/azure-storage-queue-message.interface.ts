export interface AzureStorageQueueMessage<T> {
  id: string;
  body: T;
  dequeueCount: number;
  insertedOn: Date;
  expiresOn: Date;
}
