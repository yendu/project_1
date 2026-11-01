import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { appOptions, configureApp } from './app.setup.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const app = await NestFactory.create<NestExpressApplication>(AppModule.register(env), appOptions);
configureApp(app);
app.enableShutdownHooks();
await app.listen(env.PORT);
