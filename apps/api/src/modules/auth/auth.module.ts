import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { Env } from '../../config/env.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { AuthGuard } from './auth.guard.js';
import { createFirebaseAuth, FirebaseTokenVerifier } from './firebase-token-verifier.js';
import { TOKEN_VERIFIER } from './token-verifier.js';

@Module({})
export class AuthModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AuthModule,
      imports: [AccountsModule.forRoot(env)],
      providers: [
        {
          provide: TOKEN_VERIFIER,
          useFactory: () => new FirebaseTokenVerifier(createFirebaseAuth(env.FIREBASE_PROJECT_ID)),
        },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    };
  }
}
