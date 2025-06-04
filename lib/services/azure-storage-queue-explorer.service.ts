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
      // Early return if wrapper is not valid
      if (
        !wrapper ||
        !wrapper.instance ||
        typeof wrapper.instance === 'string'
      ) {
        return;
      }

      // Enhanced checks for problematic instances that might cause asObservable errors
      if (
        wrapper.instance?.constructor &&
        (wrapper.instance.constructor.name === 'ConfigService' ||
          wrapper.instance.constructor.name === 'HttpAdapterHost' ||
          // Skip Observables or services with Observable properties
          wrapper.instance.constructor.name?.includes('Observable') ||
          // Check for ReflectiveInjector or any injector-like class that might cause issues
          wrapper.instance.constructor.name?.includes('Injector') ||
          // Check for internal NestJS HttpServer implementations
          wrapper.instance.constructor.name?.includes('HttpServer'))
      ) {
        return;
      }

      // Make sure asObservable doesn't exist on the instance to avoid potential errors
      if (
        typeof wrapper.instance?.asObservable === 'function' ||
        typeof wrapper.instance?.httpAdapter?.asObservable === 'function'
      ) {
        return;
      }

      // Check if the wrapper is properly initialized
      if (
        !wrapper.isDependencyTreeStatic?.() &&
        wrapper.isDependencyTreeStatic !== undefined
      ) {
        return;
      }

      const { instance } = wrapper;
      if (!instance || !instance.constructor) {
        return;
      }

      this.exploreInstance(instance);
    } catch (error) {
      this.logger.error('Error exploring provider:', error);
    }
  }

  private exploreInstance(instance: any) {
    try {
      // Skip problematic instances entirely to avoid the asObservable error
      if (
        instance.constructor &&
        (instance.constructor.name === 'ConfigService' ||
          instance.constructor.name === 'HttpAdapterHost' ||
          instance.constructor.name?.includes('Observable') ||
          instance.constructor.name?.includes('Injector') ||
          instance.constructor.name?.includes('HttpServer'))
      ) {
        return;
      }

      // Additional check to avoid asObservable errors
      if (
        typeof instance?.asObservable === 'function' ||
        typeof instance?.httpAdapter?.asObservable === 'function'
      ) {
        return;
      }

      const prototype = Object.getPrototypeOf(instance);
      if (!prototype) return;

      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (name) =>
          name !== 'constructor' && typeof prototype[name] === 'function',
      );

      methodNames.forEach((methodName) => {
        this.exploreMethod(instance, prototype, methodName);
      });
    } catch (error) {
      this.logger.error(
        `Error exploring instance ${instance.constructor?.name}:`,
        error,
      );
    }
  }

  private exploreMethod(instance: any, prototype: any, methodName: string) {
    try {
      // Skip problematic classes completely to avoid errors
      if (
        instance.constructor &&
        (instance.constructor.name === 'ConfigService' ||
          instance.constructor.name === 'HttpAdapterHost' ||
          instance.constructor.name?.includes('Observable') ||
          instance.constructor.name?.includes('Injector') ||
          instance.constructor.name?.includes('HttpServer'))
      ) {
        return;
      }

      const handler = prototype[methodName];
      if (!handler) return;

      // We need to check for the existence of AZURE_STORAGE_QUEUE_HANDLER_METADATA
      if (!AZURE_STORAGE_QUEUE_HANDLER_METADATA) {
        this.logger.debug(
          'AZURE_STORAGE_QUEUE_HANDLER_METADATA constant is not defined',
        );
        return;
      }

      // Safely try to get metadata
      let metadata: AzureStorageQueuePollingOptions | undefined;

      try {
        metadata = this.reflector.get<AzureStorageQueuePollingOptions>(
          AZURE_STORAGE_QUEUE_HANDLER_METADATA,
          handler as ((message: any) => Promise<void>) | Type<any>,
        );
      } catch (reflectorError) {
        // Just debug log and return - this isn't an error
        this.logger.debug(
          `No queue handler metadata for ${instance.constructor?.name}.${methodName}`,
        );
        return;
      }

      // Only proceed if we have valid metadata with a queue name
      if (metadata && metadata.queueName) {
        this.logger.log(
          `Found queue handler: ${instance.constructor.name}.${methodName} for queue: ${metadata.queueName}`,
        );

        // Bind the method to the instance
        const boundHandler = handler.bind(instance) as (
          message: any,
        ) => Promise<void>;

        // Make sure startPolling method exists
        if (typeof this.azureQueueService.startPolling === 'function') {
          this.azureQueueService.startPolling(metadata, boundHandler);
        } else {
          this.logger.error(
            'AzureQueueService.startPolling method is not available',
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error exploring method ${methodName}:`, error);
    }
  }
}
