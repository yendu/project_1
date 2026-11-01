import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { appOptions, configureApp } from '../../src/app.setup.js';
import { ProbeModule } from './probe.module.js';

/** Builds the app exactly as main.ts does, plus the test-only probe routes. */
export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ProbeModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...appOptions,
    logger: false,
  });
  configureApp(app);
  await app.init();
  return app;
}
