import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../../src/common/errors/app-error.js';

const probeOrderSchema = z.strictObject({
  name: z.string().trim().min(1).max(50),
  items: z
    .array(z.strictObject({ menuItemId: z.uuid(), quantity: z.int().min(1).max(20) }))
    .min(1)
    .max(10),
});
type ProbeOrder = z.infer<typeof probeOrderSchema>;

const probeSearchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
type ProbeSearch = z.infer<typeof probeSearchSchema>;

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

  @Post('orders')
  createOrder(@Body({ schema: probeOrderSchema }) body: ProbeOrder): ProbeOrder {
    return body;
  }

  @Get('search')
  search(@Query({ schema: probeSearchSchema }) query: ProbeSearch): ProbeSearch {
    return query;
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
