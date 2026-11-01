import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ProblemDetailsFilter } from './common/errors/problem-details.filter.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [HealthModule],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
