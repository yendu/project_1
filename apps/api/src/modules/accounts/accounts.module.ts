import { Module, type DynamicModule } from '@nestjs/common';
import type { Env } from '../../config/env.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsRepository } from './accounts.repository.js';
import { ACCOUNTS_OPTIONS, AccountsService } from './accounts.service.js';

@Module({})
export class AccountsModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AccountsModule,
      controllers: [AccountsController],
      providers: [
        AccountsRepository,
        AccountsService,
        { provide: ACCOUNTS_OPTIONS, useValue: { adminEmail: env.ADMIN_EMAIL } },
      ],
      exports: [AccountsService],
    };
  }
}
