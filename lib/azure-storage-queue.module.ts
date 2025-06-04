import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AZURE_STORAGE_QUEUE_CONFIG_PROVIDER } from './constants/azure-storage-queue.constants';
import { AzureStorageQueueConfig } from './interfaces/azure-storage-queue-config.interface';

import { AzureStorageQueueExplorerService } from './services/azure-storage-queue-explorer.service';
import { AzureStorageQueueService } from './services/azure-storage-queue.service';

@Module({})
export class AzureStorageQueueModule {
  static forRoot(config: AzureStorageQueueConfig): DynamicModule {
    const azureStorageQueueConfigProvider: Provider = {
      provide: AZURE_STORAGE_QUEUE_CONFIG_PROVIDER,
      useValue: config,
    };

    return {
      module: AzureStorageQueueModule,
      providers: [
        azureStorageQueueConfigProvider,
        AzureStorageQueueService,
        AzureStorageQueueExplorerService,
      ],
      exports: [AzureStorageQueueService],
      global: true,
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => Promise<AzureStorageQueueConfig> | AzureStorageQueueConfig;
    inject?: any[];
  }): DynamicModule {
    const azureStorageQueueConfigProvider: Provider = {
      provide: AZURE_STORAGE_QUEUE_CONFIG_PROVIDER,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };
    return {
      imports: [ConfigModule],
      module: AzureStorageQueueModule,
      providers: [
        azureStorageQueueConfigProvider,
        AzureStorageQueueService,
        AzureStorageQueueExplorerService,
      ],
      exports: [AzureStorageQueueService],
      global: true,
    };
  }
}
