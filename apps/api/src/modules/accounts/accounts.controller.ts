import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type CurrentAccount } from '../auth/auth.decorators.js';
import { AccountsService, type AccountProfile } from './accounts.service.js';

@Controller('me')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  me(@CurrentUser() account: CurrentAccount): Promise<AccountProfile> {
    return this.accountsService.getProfile(account.id);
  }
}
