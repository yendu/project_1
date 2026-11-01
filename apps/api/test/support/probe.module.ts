import { Controller, Get, Module } from '@nestjs/common';

/** Test-only routes for exercising app-wide behavior. Never imported by the app itself. */
@Controller('probe')
class ProbeController {
  @Get('ok')
  ok(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [ProbeController] })
export class ProbeModule {}
