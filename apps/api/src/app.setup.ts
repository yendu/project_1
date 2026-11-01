import { VersioningType, type NestApplicationOptions } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

/** Options for creating the app, shared by main.ts and the tests. */
export const appOptions = {} satisfies NestApplicationOptions;

/**
 * App-wide setup applied before `init()`, shared by main.ts and the tests so the tests
 * exercise what production runs.
 */
export function configureApp(app: NestExpressApplication): void {
  // Controllers live under /v1 unless they opt out with VERSION_NEUTRAL (/healthz, /readyz).
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}
