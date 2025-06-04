import { QueueClient, QueueServiceClient } from '@azure/storage-queue';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AZURE_STORAGE_QUEUE_CONFIG_PROVIDER } from '../constants/azure-storage-queue.constants';
import { AzureStorageQueueConfig } from '../interfaces/azure-storage-queue-config.interface';
import { AzureStorageQueueMessage } from '../interfaces/azure-storage-queue-message.interface';
import { AzureStorageQueuePollingOptions } from '../interfaces/azure-storage-queue-polling-options.interface';

@Injectable()
export class AzureStorageQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(AzureStorageQueueService.name);
  private queueServiceClient: QueueServiceClient;
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isShuttingDown = false;

  constructor(
    @Inject(AZURE_STORAGE_QUEUE_CONFIG_PROVIDER)
    private readonly config: AzureStorageQueueConfig,
  ) {
    this.queueServiceClient = QueueServiceClient.fromConnectionString(
      this.config.connectionString,
    );
  }

  async createQueueIfNotExists(queueName: string): Promise<QueueClient> {
    const queueClient = this.queueServiceClient.getQueueClient(queueName);
    await queueClient.createIfNotExists();
    return queueClient;
  }

  async sendMessage<T = string>(queueName: string, message: T): Promise<void> {
    const queueClient = await this.createQueueIfNotExists(queueName);

    // Handle different message types - serialize objects to JSON strings
    const messageContent =
      typeof message === 'string' ? message : JSON.stringify(message);

    await queueClient.sendMessage(messageContent);
  }

  async startPolling<T = string>(
    options: AzureStorageQueuePollingOptions,
    handler: (message: AzureStorageQueueMessage<T>) => Promise<void>,
  ): Promise<void> {
    const {
      queueName,
      pollingInterval = this.config.defaultPollingInterval || 5000,
      visibilityTimeout = this.config.defaultVisibilityTimeout || 30,
      maxMessages = 1,
    } = options;

    if (this.pollingIntervals.has(queueName)) {
      this.logger.warn(`Polling already started for queue: ${queueName}`);
      return;
    }

    const queueClient = await this.createQueueIfNotExists(queueName);

    const poll = async () => {
      if (this.isShuttingDown) return;

      try {
        const response = await queueClient.receiveMessages({
          numberOfMessages: maxMessages,
          visibilityTimeout,
        });

        if (response.receivedMessageItems?.length) {
          for (const message of response.receivedMessageItems) {
            try {
              // Parse messageText as JSON if T is not a string type
              const parsedBody =
                typeof message.messageText === 'string' &&
                message.messageText.startsWith('{')
                  ? (JSON.parse(message.messageText) as T)
                  : (message.messageText as unknown as T);

              await handler({
                id: message.messageId,
                body: parsedBody,
                dequeueCount: message.dequeueCount,
                insertedOn: message.insertedOn,
                expiresOn: message.expiresOn,
              });

              // Delete message after successful processing
              await queueClient.deleteMessage(
                message.messageId,
                message.popReceipt,
              );

              this.logger.debug(
                `Message processed and deleted: ${message.messageId}`,
              );
            } catch (error) {
              this.logger.error(
                `Error processing message ${message.messageId}:`,
                error,
              );

              // Check if message has exceeded max dequeue count
              if (
                message.dequeueCount >=
                (options.maxDequeueCount ||
                  this.config.defaultMaxDequeueCount ||
                  5)
              ) {
                this.logger.warn(
                  `Message ${message.messageId} exceeded max dequeue count, deleting`,
                );
                await queueClient.deleteMessage(
                  message.messageId,
                  message.popReceipt,
                );
              }
            }
          }
        }
      } catch (error) {
        this.logger.error(`Error polling queue ${queueName}:`, error);
      }

      if (!this.isShuttingDown) {
        const timeoutId = setTimeout(poll, pollingInterval);
        this.pollingIntervals.set(queueName, timeoutId);
      }
    };

    this.logger.log(`Starting polling for queue: ${queueName}`);
    poll();
  }

  stopPolling(queueName: string): void {
    const timeoutId = this.pollingIntervals.get(queueName);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.pollingIntervals.delete(queueName);
      this.logger.log(`Stopped polling for queue: ${queueName}`);
    }
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
    this.pollingIntervals.forEach((timeoutId, queueName) => {
      clearTimeout(timeoutId);
      this.logger.log(`Stopped polling for queue: ${queueName}`);
    });
    this.pollingIntervals.clear();
  }
}
