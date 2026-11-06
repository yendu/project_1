import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from '../auth/auth.decorators.js';
import { HealthService, type HealthResponse } from './health.service.js';

@Public()
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('healthz')
  check(): HealthResponse {
    return this.healthService.check();
  }

  @Get('readyz')
  ready(): Promise<HealthResponse> {
    return this.healthService.ready();
  }
}
