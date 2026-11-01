import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../../src/common/errors/app-error.js';

/** Test-only routes for exercising app-wide behavior. Never imported by the app itself. */
@Controller('probe')
class ProbeController {
  @Get('ok')
  ok(): { ok: true } {
    return { ok: true };
  }

  @Post('echo')
  echo(@Body() body: unknown): unknown {
    return body;
  }

  @Get('not-found')
  notFound(): never {
    throw new NotFoundError();
  }

  @Get('conflict')
  conflict(): never {
    throw new ConflictError('probe_conflict', 'The probe is in the wrong state.');
  }

  @Get('business-rule')
  businessRule(): never {
    throw new BusinessRuleError('probe_rule_broken', 'The probe broke a rule.');
  }

  @Get('crash')
  crash(): never {
    throw new Error('secret internal detail from db.internal:5432');
  }
}

@Module({ controllers: [ProbeController] })
export class ProbeModule {}
