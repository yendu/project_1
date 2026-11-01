import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import { ProblemDetailsFilter } from './common/errors/problem-details.filter.js';
import { createHttpLogger, HTTP_LOGGER } from './common/logging/http-logger.js';
import type { Env } from './config/env.js';
import { HealthModule } from './modules/health/health.module.js';

export interface AppModuleOptions {
  /** Where logs go. Defaults to stdout; tests pass a stream to capture them. */
  logDestination?: DestinationStream;
}

@Module({})
export class AppModule {
  static register(env: Env, options: AppModuleOptions = {}): DynamicModule {
    const httpLogger = createHttpLogger(env.LOG_LEVEL, options.logDestination);
    return {
      module: AppModule,
      imports: [
        // configureApp mounts httpLogger ahead of the body parser, so nestjs-pino reuses its
        // logger (useExisting) instead of adding its own pino-http after the parser.
        LoggerModule.forRoot({ pinoHttp: { logger: httpLogger.logger }, useExisting: true }),
        HealthModule,
      ],
      providers: [
        { provide: HTTP_LOGGER, useValue: httpLogger },
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
      ],
    };
  }
}
