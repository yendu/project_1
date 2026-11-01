import { Controller, Get } from '@nestjs/common';
import { HealthService, type HealthResponse } from './health.service.js';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('healthz')
  check(): HealthResponse {
    return this.healthService.check();
  }
}
