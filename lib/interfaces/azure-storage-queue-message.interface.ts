export interface AzureStorageQueueMessage {
  id: string;
  body: string;
  dequeueCount: number;
  insertedOn: Date;
  expiresOn: Date;
}
