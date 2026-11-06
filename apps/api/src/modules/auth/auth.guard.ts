import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../db/schema/accounts.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { ALLOWED_ROLES, IS_PUBLIC, type AuthenticatedRequest } from './auth.decorators.js';
import {
  InvalidTokenError,
  TOKEN_VERIFIER,
  TokenCheckUnavailableError,
  type TokenVerifier,
  type VerifiedToken,
} from './token-verifier.js';

const BEARER_TOKEN = /^Bearer (\S+)$/i;

/** Runs on every route. A route is closed unless it is marked `@Public()`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly tokenVerifier: TokenVerifier,
    private readonly accountsService: AccountsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = BEARER_TOKEN.exec(request.headers.authorization ?? '')?.[1];
    if (!token) throw new UnauthorizedException();

    const account = await this.accountsService.signIn(await this.verify(token));
    request.account = account;

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ALLOWED_ROLES, targets);
    if (roles && !roles.includes(account.role)) throw new ForbiddenException();
    return true;
  }

  private async verify(token: string): Promise<VerifiedToken> {
    try {
      return await this.tokenVerifier.verify(token);
    } catch (error) {
      if (error instanceof InvalidTokenError) throw new UnauthorizedException();
      if (error instanceof TokenCheckUnavailableError) {
        // The client gets a generic 503; the cause goes to the server log.
        throw new ServiceUnavailableException('Token check unavailable', { cause: error });
      }
      throw error;
    }
  }
}
