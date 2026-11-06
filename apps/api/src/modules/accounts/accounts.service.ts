import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/app-error.js';
import type { UserRole } from '../../db/schema/accounts.js';
import type { CurrentAccount } from '../auth/auth.decorators.js';
import type { VerifiedToken } from '../auth/token-verifier.js';
import { AccountsRepository } from './accounts.repository.js';

export const ACCOUNTS_OPTIONS = Symbol('ACCOUNTS_OPTIONS');

export interface AccountsOptions {
  adminEmail: string | undefined;
}

export interface AccountProfile {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
}

const GOOGLE_PROVIDER = 'google.com';

@Injectable()
export class AccountsService {
  constructor(
    private readonly accountsRepository: AccountsRepository,
    @Inject(ACCOUNTS_OPTIONS) private readonly options: AccountsOptions,
  ) {}

  /** Finds the caller's account, creating or linking it on their first sign-in. */
  async signIn(token: VerifiedToken): Promise<CurrentAccount> {
    if (token.provider !== GOOGLE_PROVIDER || !token.emailVerified || !token.email) {
      throw new UnauthorizedException();
    }

    const existing = await this.accountsRepository.findByFirebaseUid(token.uid);
    if (existing) return existing;

    const email = token.email.toLowerCase();
    const account = await this.accountsRepository.createOrLink({
      email,
      firebaseUid: token.uid,
      name: token.name?.trim() || (email.split('@')[0] ?? email),
      isAdmin: email === this.options.adminEmail,
    });
    if (!account) {
      throw new ConflictError('email_in_use', 'This email already belongs to another account.');
    }
    return account;
  }

  async getProfile(id: string): Promise<AccountProfile> {
    const profile = await this.accountsRepository.findProfile(id);
    if (!profile) throw new NotFoundError();
    return profile;
  }
}
