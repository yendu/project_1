import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Database } from '../../db/database.js';

@Injectable()
export class HealthRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Resolves once PostgreSQL has answered a trivial query. */
  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }
}
