import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DB, type Database } from '../../db/database.js';
import { customers, users, type UserRole } from '../../db/schema/accounts.js';

export interface AccountRow {
  id: string;
  email: string;
  role: UserRole;
}

export interface ProfileRow extends AccountRow {
  name: string | null;
}

export interface FirstSignIn {
  email: string;
  firebaseUid: string;
  name: string;
  isAdmin: boolean;
}

const accountColumns = { id: users.id, email: users.email, role: users.role };

@Injectable()
export class AccountsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findByFirebaseUid(firebaseUid: string): Promise<AccountRow | undefined> {
    const [row] = await this.db
      .select(accountColumns)
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);
    return row;
  }

  async findProfile(id: string): Promise<ProfileRow | undefined> {
    const [row] = await this.db
      .select({ ...accountColumns, name: customers.name })
      .from(users)
      .leftJoin(customers, eq(customers.userId, users.id))
      .where(eq(users.id, id))
      .limit(1);
    return row;
  }

  /**
   * Creates the user, or links a row an admin added for this email. One atomic statement, so
   * requests racing through a first sign-in end up with one user. Returns nothing when the email
   * already belongs to a different Firebase account.
   */
  async createOrLink(signIn: FirstSignIn): Promise<AccountRow | undefined> {
    const { email, firebaseUid, name, isAdmin } = signIn;
    const adminRole = isAdmin ? { role: 'admin' as const } : {};

    return this.db.transaction(async (tx) => {
      const [account] = await tx
        .insert(users)
        .values({ email, firebaseUid, ...adminRole })
        .onConflictDoUpdate({
          target: users.email,
          set: { firebaseUid, ...adminRole, updatedAt: sql`now()` },
          setWhere: sql`${users.firebaseUid} is null or ${users.firebaseUid} = ${firebaseUid}`,
        })
        .returning(accountColumns);

      if (account?.role === 'customer') {
        await tx
          .insert(customers)
          .values({ userId: account.id, name })
          .onConflictDoNothing({ target: customers.userId });
      }
      return account;
    });
  }
}
