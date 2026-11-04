import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import { ProblemDetailsFilter } from './common/errors/problem-details.filter.js';
import { createHttpLogger, HTTP_LOGGER, logSerializers } from './common/logging/http-logger.js';
import { createValidationPipe } from './common/validation.js';
import type { Env } from './config/env.js';
import { DatabaseModule } from './db/database.module.js';
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
        LoggerModule.forRoot({
          pinoHttp: { logger: httpLogger.logger, serializers: logSerializers },
          useExisting: true,
        }),
        DatabaseModule.forRoot(env),
        HealthModule,
      ],
      providers: [
        { provide: HTTP_LOGGER, useValue: httpLogger },
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
        { provide: APP_PIPE, useFactory: createValidationPipe },
      ],
    };
  }
}
