import {
  Global,
  Inject,
  Injectable,
  Module,
  type DynamicModule,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DatabaseError, Pool } from 'pg';
import type { Env } from '../config/env.js';
import { createDatabase, createPool, DB, PG_POOL } from './database.js';

@Injectable()
class DatabaseLifecycle implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly logger: PinoLogger,
  ) {
    logger.setContext(DatabaseModule.name);
  }

  onModuleInit(): void {
    // pg emits this when an idle connection dies (database restart, network).
    // Without a listener it is an uncaught exception that takes the process down.
    this.pool.on('error', (err) => {
      // Picked fields only: pg attaches the whole connection to the error.
      const summary = {
        type: err.constructor.name,
        code: err instanceof DatabaseError ? err.code : undefined,
        message: err.message,
      };
      this.logger.error({ error: summary }, 'Idle database connection failed');
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        { provide: PG_POOL, useFactory: () => createPool(env) },
        { provide: DB, useFactory: createDatabase, inject: [PG_POOL] },
        DatabaseLifecycle,
      ],
      exports: [DB],
    };
  }
}
