import { SetMetadata } from '@nestjs/common';
import { AZURE_STORAGE_QUEUE_HANDLER_METADATA } from '../constants/azure-storage-queue.constants';
import { AzureStorageQueuePollingOptions } from '../interfaces/azure-storage-queue-polling-options.interface';

export function AzureStorageQueueHandler(
  options: AzureStorageQueuePollingOptions,
): MethodDecorator {
  return SetMetadata(AZURE_STORAGE_QUEUE_HANDLER_METADATA, options);
}
