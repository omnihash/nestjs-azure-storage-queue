# @omnihash/nestjs-azure-storage-queue

A NestJS module for seamless Azure Storage Queue integration with automatic message processing through decorators.

**NOTE:** This module is currently under development. Please do not use in production.

---

## Features

✨ **Decorator-based Queue Handlers** - Use simple decorators to mark methods as queue message processors  
🔄 **Automatic Message Polling** - Built-in polling mechanism with configurable intervals  
⚙️ **Flexible Configuration** - Support for both synchronous and asynchronous configuration  
🛡️ **Error Handling** - Automatic retry logic with configurable dequeue limits  
📝 **Comprehensive Logging** - Built-in logging for monitoring and debugging  
🚀 **Auto-discovery** - Automatically discovers and registers queue handlers at startup

---

## Installation

```bash
npm install @omnihash/nestjs-azure-storage-queue @azure/storage-queue
# or
yarn add @omnihash/nestjs-azure-storage-queue @azure/storage-queue
```

---

## Quick Start

### 1. Configure Environment

Create a `.env` file in your project root:

```env
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=youraccount;AccountKey=yourkey;EndpointSuffix=core.windows.net
```

### 2. Setup Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AzureStorageQueueModule } from '@omnihash/nestjs-azure-storage-queue';
import { MessageProcessorService } from './message-processor.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AzureStorageQueueModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>(
          'AZURE_STORAGE_CONNECTION_STRING',
        );
        if (!connectionString) {
          throw new Error('AZURE_STORAGE_CONNECTION_STRING must be defined');
        }
        return {
          connectionString,
          defaultPollingInterval: 5000,
          defaultVisibilityTimeout: 30,
          defaultMaxDequeueCount: 5,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [MessageProcessorService],
})
export class AppModule {}
```

### 3. Create Message Processors

```typescript
// message-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AzureStorageQueueHandler } from '@omnihash/nestjs-azure-storage-queue';

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);

  @AzureStorageQueueHandler({
    queueName: 'user-notifications',
    pollingInterval: 3000,
    visibilityTimeout: 30,
    maxDequeueCount: 1,
    maxMessages: 10,
  })
  async handleUserNotifications(message: any) {
    this.logger.log(`Processing user notification: ${message.id}`);
    this.logger.log(`Message body: ${message.body}`);

    // Process your message here
    const data = JSON.parse(message.body);

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.logger.log(`Completed processing message: ${message.id}`, data);
  }

  @AzureStorageQueueHandler({
    queueName: 'order-processing',
    pollingInterval: 1000,
    visibilityTimeout: 60,
    maxMessages: 20,
    maxDequeueCount: 10,
  })
  async handleOrderProcessing(message: any) {
    this.logger.log(`Processing order: ${message.id}`);

    try {
      const orderData = JSON.parse(message.body);
      // Process order logic here

      this.logger.log(`Order processed successfully: ${orderData.orderId}`);
    } catch (error) {
      this.logger.error(`Failed to process order: ${error.message}`);
      throw error; // This will cause the message to be retried
    }
  }
}
```

---

## Configuration

### Module Configuration Options

| Option                     | Type     | Description                                       | Default    |
| -------------------------- | -------- | ------------------------------------------------- | ---------- |
| `connectionString`         | `string` | Azure Storage connection string                   | _required_ |
| `defaultPollingInterval`   | `number` | Default polling interval in milliseconds          | `5000`     |
| `defaultVisibilityTimeout` | `number` | Default message visibility timeout in seconds     | `30`       |
| `defaultMaxDequeueCount`   | `number` | Default maximum dequeue count before poison queue | `5`        |

### Queue Handler Options

| Option              | Type     | Description                           | Default        |
| ------------------- | -------- | ------------------------------------- | -------------- |
| `queueName`         | `string` | Name of the Azure Storage Queue       | _required_     |
| `pollingInterval`   | `number` | Polling interval in milliseconds      | Module default |
| `visibilityTimeout` | `number` | Message visibility timeout in seconds | Module default |
| `maxMessages`       | `number` | Maximum messages to retrieve per poll | `1`            |
| `maxDequeueCount`   | `number` | Maximum dequeue count before deletion | Module default |

---

## Advanced Usage

### Static Configuration

```typescript
// app.module.ts
import { AzureStorageQueueModule } from '@omnihash/nestjs-azure-storage-queue';

@Module({
  imports: [
    AzureStorageQueueModule.forRoot({
      connectionString: 'your-connection-string',
      defaultPollingInterval: 3000,
      defaultVisibilityTimeout: 45,
      defaultMaxDequeueCount: 3,
    }),
  ],
})
export class AppModule {}
```

### Sending Messages

```typescript
import { Injectable } from '@nestjs/common';
import { AzureStorageQueueService } from '@omnihash/nestjs-azure-storage-queue';

@Injectable()
export class NotificationService {
  constructor(private readonly queueService: AzureStorageQueueService) {}

  async sendNotification(userId: string, message: string) {
    const queueMessage = JSON.stringify({
      userId,
      message,
      timestamp: new Date().toISOString(),
    });

    await this.queueService.sendMessage('user-notifications', queueMessage);
  }

  async sendOrderUpdate(orderId: string, status: string) {
    const orderMessage = JSON.stringify({
      orderId,
      status,
      updatedAt: new Date().toISOString(),
    });

    await this.queueService.sendMessage('order-processing', orderMessage);
  }
}
```

### Multiple Queue Handlers

```typescript
@Injectable()
export class MultiQueueProcessor {
  private readonly logger = new Logger(MultiQueueProcessor.name);

  @AzureStorageQueueHandler({
    queueName: 'high-priority',
    pollingInterval: 1000,
    maxMessages: 5,
  })
  async handleHighPriority(message: any) {
    this.logger.log(`High priority: ${message.body}`);
    // Handle high priority messages
  }

  @AzureStorageQueueHandler({
    queueName: 'low-priority',
    pollingInterval: 10000,
    maxMessages: 10,
  })
  async handleLowPriority(message: any) {
    this.logger.log(`Low priority: ${message.body}`);
    // Handle low priority messages
  }

  @AzureStorageQueueHandler({
    queueName: 'batch-processing',
    pollingInterval: 5000,
    maxMessages: 32, // Azure Storage Queue max
    visibilityTimeout: 120,
  })
  async handleBatchProcessing(message: any) {
    this.logger.log(`Batch processing: ${message.body}`);
    // Handle batch processing
  }
}
```

---

## Message Format

Messages received by your handlers will have the following structure:

```typescript
interface QueueMessage {
  id: string; // Message ID
  body: string; // Message content
  dequeueCount: number; // Number of times dequeued
  insertedOn: Date; // When message was inserted
  expiresOn: Date; // When message expires
}
```

---

## Error Handling

### Automatic Retry Logic

When a handler throws an error, the message becomes visible again after the `visibilityTimeout` and will be retried. If a message exceeds `maxDequeueCount`, it will be automatically deleted (poison message handling).

### Custom Error Handling

```typescript
@AzureStorageQueueHandler({
  queueName: 'error-prone-queue',
  maxDequeueCount: 3,
})
async handleWithErrors(message: any) {
  try {
    // Process message
    await this.processMessage(message.body);
  } catch (error) {
    this.logger.error(`Processing failed: ${error.message}`, {
      messageId: message.id,
      dequeueCount: message.dequeueCount,
    });

    if (message.dequeueCount >= 2) {
      // Send to dead letter queue or alert
      await this.handlePoisonMessage(message);
    }

    throw error; // Re-throw to trigger retry
  }
}
```

---

## Best Practices

1. **Queue Naming**: Use descriptive, kebab-case names for queues
2. **Message Size**: Keep messages under 64KB (Azure Storage Queue limit)
3. **Idempotency**: Design handlers to be idempotent in case of retries
4. **Monitoring**: Use the built-in logging to monitor queue processing
5. **Error Handling**: Implement proper error handling and poison message detection
6. **Resource Cleanup**: The module automatically cleans up polling intervals on shutdown

---

## API Reference

### AzureStorageQueueModule

#### Static Methods

- **`forRoot(config: AzureStorageQueueConfig): DynamicModule`**  
  Configure the module with static configuration

- **`forRootAsync(options: AsyncModuleOptions): DynamicModule`**  
  Configure the module with dynamic configuration using factories

### AzureStorageQueueService

#### Methods

- **`sendMessage(queueName: string, message: string): Promise<void>`**  
  Send a message to the specified queue

- **`createQueueIfNotExists(queueName: string): Promise<QueueClient>`**  
  Create a queue if it doesn't exist and return the client

- **`startPolling(options: PollingOptions, handler: Function): Promise<void>`**  
  Start polling a queue (used internally by the decorator)

- **`stopPolling(queueName: string): void`**  
  Stop polling a specific queue

### @AzureStorageQueueHandler

Decorator to mark methods as queue message handlers.

```typescript
@AzureStorageQueueHandler(options: AzureStorageQueuePollingOptions)
```

---

## Troubleshooting

### Common Issues

**Connection String Invalid**

```
Error: AZURE_STORAGE_CONNECTION_STRING must be defined
```

Ensure your connection string is properly set in environment variables.

**Queue Not Found**
Queues are automatically created when first accessed. Ensure your Azure Storage account has the necessary permissions.

**Messages Not Processing**
Check that:

- Your handler methods are in services registered with NestJS
- The `@AzureStorageQueueHandler` decorator is properly applied
- Queue names match exactly (case-sensitive)

### Debug Logging

Enable debug logging to see module activity:

```typescript
// main.ts
import { Logger } from '@nestjs/common';

const app = await NestFactory.create(AppModule, {
  logger: ['error', 'warn', 'log', 'debug'],
});
```

---

## License

MIT

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
