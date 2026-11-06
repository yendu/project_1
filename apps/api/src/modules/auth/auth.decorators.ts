import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { UserRole } from '../../db/schema/accounts.js';

export const IS_PUBLIC = Symbol('IS_PUBLIC');
export const ALLOWED_ROLES = Symbol('ALLOWED_ROLES');

/** The signed-in caller, as the guard attaches it to the request. */
export interface CurrentAccount {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest {
  headers: { authorization?: string | undefined };
  account?: CurrentAccount;
}

/** Opens a route or controller to callers who aren't signed in. Everything else needs sign-in. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Limits a route or controller to these roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ALLOWED_ROLES, roles);

/** The signed-in caller. Only for routes behind the guard, so never on a `@Public()` route. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentAccount | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().account,
);
