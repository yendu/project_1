import { Body, Controller, Get, Inject, Module, Post, Query } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../../src/common/errors/app-error.js';
import { DB, type Database } from '../../src/db/database.js';

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

const probeValueSchema = z.strictObject({ value: z.string().max(100) });
type ProbeValue = z.infer<typeof probeValueSchema>;

/** Test-only routes for exercising app-wide behavior. Never imported by the app itself. */
@Controller('probe')
class ProbeController {
  constructor(@Inject(DB) private readonly db: Database) {}

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

  /** PostgreSQL quotes the value in its error message. */
  @Post('failing-query')
  async failingQuery(@Body({ schema: probeValueSchema }) body: ProbeValue): Promise<void> {
    await this.db.execute(sql`select ${body.value}::int`);
  }

  /** PostgreSQL quotes the row in the error's detail field. */
  @Post('duplicate-key')
  async duplicateKey(@Body({ schema: probeValueSchema }) body: ProbeValue): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`create temporary table probe_emails (email text primary key) on commit drop`,
      );
      await tx.execute(sql`insert into probe_emails values (${body.value})`);
      await tx.execute(sql`insert into probe_emails values (${body.value})`);
    });
  }
}

@Module({ controllers: [ProbeController] })
export class ProbeModule {}
