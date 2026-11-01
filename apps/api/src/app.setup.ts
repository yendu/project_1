import { VersioningType, type NestApplicationOptions } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import type { HttpLogger } from 'pino-http';
import { HTTP_LOGGER } from './common/logging/http-logger.js';
import { requestIdMiddleware } from './common/request-id.js';

/** Options for creating the app, shared by main.ts and the tests. */
export const appOptions = {
  // Hold Nest's startup logs until pino takes over, so every line is JSON.
  bufferLogs: true,
} satisfies NestApplicationOptions;

/**
 * App-wide setup applied before `init()`, shared by main.ts and the tests so the tests
 * exercise what production runs.
 */
export function configureApp(app: NestExpressApplication): void {
  app.useLogger(app.get(Logger));

  // Express-level middleware runs in registration order, ahead of everything Nest adds at init.
  app.use(requestIdMiddleware);
  app.use(app.get<HttpLogger>(HTTP_LOGGER));

  // Controllers live under /v1 unless they opt out with VERSION_NEUTRAL (/healthz, /readyz).
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}
