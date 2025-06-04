import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Type,
} from '@nestjs/common';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Module } from '@nestjs/core/injector/module';
import { AZURE_STORAGE_QUEUE_HANDLER_METADATA } from '../constants/azure-storage-queue.constants';
import { AzureStorageQueuePollingOptions } from '../interfaces/azure-storage-queue-polling-options.interface';
import { AzureStorageQueueService } from './azure-storage-queue.service';

@Injectable()
export class AzureStorageQueueExplorerService
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(AzureStorageQueueExplorerService.name);

  constructor(
    private readonly modulesContainer: ModulesContainer,
    private readonly reflector: Reflector,
    private readonly azureQueueService: AzureStorageQueueService,
  ) {}

  onApplicationBootstrap() {
    this.explore();
  }

  private explore() {
    try {
      const modules = [...this.modulesContainer.values()];
      this.logger.debug(
        `Exploring ${modules.length} modules for queue handlers`,
      );

      modules.forEach((module) => {
        this.exploreModule(module);
      });
    } catch (error) {
      this.logger.error('Error during module exploration:', error);
    }
  }

  private exploreModule(module: Module) {
    try {
      if (!module || !module.providers) {
        return;
      }

      const providers = [...module.providers.values()];
      this.logger.debug(`Exploring ${providers.length} providers in module`);

      providers.forEach((wrapper: InstanceWrapper) => {
        this.exploreProvider(wrapper);
      });
    } catch (error) {
      this.logger.error('Error exploring module:', error);
    }
  }

  private exploreProvider(wrapper: InstanceWrapper) {
    try {
      // Safely validate wrapper
      if (!this.isValidWrapper(wrapper)) {
        return;
      }

      const { instance } = wrapper;

      // Additional safety checks before exploring
      if (!this.canSafelyExploreInstance(instance)) {
        return;
      }

      this.exploreInstance(instance);
    } catch (error) {
      this.logger.debug(`Skipping provider due to error: ${error.message}`);
      // Don't log as error since this is expected for some providers
    }
  }

  private isValidWrapper(wrapper: any): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return (
        wrapper &&
        wrapper.instance &&
        typeof wrapper.instance === 'object' &&
        wrapper.instance.constructor &&
        typeof wrapper.instance.constructor === 'function'
      );
    } catch {
      return false;
    }
  }

  private canSafelyExploreInstance(instance: any): boolean {
    try {
      // Check if we can safely access the instance properties
      if (!instance || typeof instance !== 'object') {
        return false;
      }

      // Try to access constructor safely
      const constructor = instance.constructor as
        | (new (...args: any[]) => any)
        | undefined;
      if (!constructor || typeof constructor !== 'function') {
        return false;
      }

      // Try to get prototype safely
      const prototype = Object.getPrototypeOf(instance);
      if (!prototype) {
        return false;
      }

      // Check if we can enumerate properties safely
      Object.getOwnPropertyNames(prototype);

      return true;
    } catch {
      return false;
    }
  }

  private exploreInstance(instance: any) {
    try {
      // Safe property access with multiple fallbacks
      if (!this.canSafelyExploreInstance(instance)) {
        return;
      }

      const prototype = this.safeGetPrototype(instance);
      if (!prototype) {
        return;
      }

      const methodNames = this.safeGetMethodNames(prototype);
      if (methodNames.length === 0) {
        return;
      }

      methodNames.forEach((methodName) => {
        this.exploreMethod(instance, prototype, methodName);
      });
    } catch (error) {
      this.logger.debug(`Skipping instance exploration: ${error.message}`);
    }
  }

  private safeGetPrototype(instance: any): any {
    try {
      return Object.getPrototypeOf(instance);
    } catch {
      return null;
    }
  }

  private safeGetMethodNames(prototype: any): string[] {
    try {
      if (!prototype || typeof prototype !== 'object') {
        return [];
      }

      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (name) => {
          try {
            return (
              name !== 'constructor' && typeof prototype[name] === 'function'
            );
          } catch {
            return false;
          }
        },
      );

      return methodNames;
    } catch {
      return [];
    }
  }

  private exploreMethod(instance: any, prototype: any, methodName: string) {
    try {
      const handler = this.safeGetHandler(prototype, methodName);
      if (!handler) {
        return;
      }

      const metadata = this.safeGetMetadata(handler);
      if (!metadata || !metadata.queueName) {
        return;
      }

      this.registerQueueHandler(instance, handler, metadata, methodName);
    } catch (error) {
      this.logger.debug(`Skipping method ${methodName}: ${error.message}`);
    }
  }

  private safeGetHandler(
    prototype: any,
    methodName: string,
  ): ((...args: any[]) => any) | null {
    try {
      const handler = prototype[methodName];
      return typeof handler === 'function'
        ? (handler as (...args: any[]) => any)
        : null;
    } catch {
      return null;
    }
  }

  private safeGetMetadata(
    handler: (...args: any[]) => any,
  ): AzureStorageQueuePollingOptions | null {
    try {
      if (!AZURE_STORAGE_QUEUE_HANDLER_METADATA) {
        return null;
      }

      const metadata = this.reflector.get<AzureStorageQueuePollingOptions>(
        AZURE_STORAGE_QUEUE_HANDLER_METADATA,
        handler as ((message: any) => Promise<void>) | Type<any>,
      );

      return metadata || null;
    } catch {
      return null;
    }
  }

  private registerQueueHandler(
    instance: any,
    handler: (...args: any[]) => any,
    metadata: AzureStorageQueuePollingOptions,
    methodName: string,
  ) {
    try {
      const constructorName = this.safeGetConstructorName(instance);

      this.logger.log(
        `Found queue handler: ${constructorName}.${methodName} for queue: ${metadata.queueName}`,
      );

      const boundHandler = handler.bind(instance) as (
        message: any,
      ) => Promise<void>;

      if (typeof this.azureQueueService.startPolling === 'function') {
        this.azureQueueService.startPolling(metadata, boundHandler);
      } else {
        this.logger.error(
          'AzureQueueService.startPolling method is not available',
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to register queue handler ${methodName}: ${error.message}`,
      );
    }
  }

  private safeGetConstructorName(instance: any): string {
    try {
      const name = instance?.constructor?.name;
      return typeof name === 'string' ? name : 'Unknown';
    } catch {
      return 'Unknown';
    }
  }
}
