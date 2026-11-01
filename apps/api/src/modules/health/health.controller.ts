import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthService, type HealthResponse } from './health.service.js';

@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('healthz')
  check(): HealthResponse {
    return this.healthService.check();
  }
}
