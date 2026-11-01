import { VersioningType, type NestApplicationOptions } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import type { HttpLogger } from 'pino-http';
import { HTTP_LOGGER } from './common/logging/http-logger.js';
import { REQUEST_ID_HEADER, requestIdMiddleware } from './common/request-id.js';
import type { Env } from './config/env.js';

const JSON_BODY_LIMIT = '100kb';

/** Options for creating the app, shared by main.ts and the tests. */
export const appOptions = {
  // Hold Nest's startup logs until pino takes over, so every line is JSON.
  bufferLogs: true,
  // configureApp registers a JSON-only parser instead of Nest's JSON + urlencoded defaults.
  bodyParser: false,
} satisfies NestApplicationOptions;

/**
 * App-wide setup applied before `init()`, shared by main.ts and the tests so the tests
 * exercise what production runs.
 */
export function configureApp(app: NestExpressApplication, env: Env): void {
  app.useLogger(app.get(Logger));

  // Express-level middleware runs in registration order, ahead of everything Nest adds at init.
  // The request id and logger come first so even requests rejected by later steps are traced.
  app.use(requestIdMiddleware);
  app.use(app.get<HttpLogger>(HTTP_LOGGER));
  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });

  // Controllers live under /v1 unless they opt out with VERSION_NEUTRAL (/healthz, /readyz).
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}
