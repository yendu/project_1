import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { DestinationStream } from 'pino';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { appOptions, configureApp } from '../../src/app.setup.js';
import { loadEnv } from '../../src/config/env.js';
import { TOKEN_VERIFIER, type TokenVerifier } from '../../src/modules/auth/token-verifier.js';
import { FakeTokenVerifier } from './fake-token-verifier.js';
import { ProbeModule } from './probe.module.js';

export interface TestAppOptions {
  /** Environment variables on top of the test defaults (including the test run's database). */
  env?: Record<string, string>;
  /** Where logs go. Logging is silent unless `env.LOG_LEVEL` is set. */
  logDestination?: DestinationStream;
  /** Replaces the fake token checker every test app uses instead of Firebase. */
  tokenVerifier?: TokenVerifier;
}

/** Builds the app exactly as main.ts does, plus the test-only probe routes. */
export async function createTestApp(options: TestAppOptions = {}): Promise<NestExpressApplication> {
  const env = loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: inject('databaseUrl'),
    FIREBASE_PROJECT_ID: 'demo-food-delivery',
    ...options.env,
  });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(env, { logDestination: options.logDestination }), ProbeModule],
  })
    .overrideProvider(TOKEN_VERIFIER)
    .useValue(options.tokenVerifier ?? new FakeTokenVerifier())
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>(appOptions);
  configureApp(app, env);
  await app.init();
  return app;
}
