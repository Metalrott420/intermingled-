/**
 * Grant or revoke admin rights for a user by email.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx src/grant-admin.ts <email>
 *   pnpm --filter @workspace/scripts exec tsx src/grant-admin.ts <email> --revoke
 */
import { eq } from "drizzle-orm";
import { db, pool, usersTable } from "@workspace/db";

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");

if (!email) {
  console.error("Usage: tsx src/grant-admin.ts <email> [--revoke]");
  process.exit(1);
}

async function run() {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user) {
    console.error(`\n✗ No user found with email: ${email}`);
    console.error("  Make sure the user has signed in at least once.\n");
    process.exit(1);
  }

  await db.update(usersTable).set({ isAdmin: !revoke }).where(eq(usersTable.id, user.id));

  console.log(`
✓ ${revoke ? "Admin revoked" : "Admin granted"}!

  Name  : ${user.name}
  Email : ${user.email}
  ID    : ${user.id}
  Admin : ${!revoke}
`);
}

run().finally(() => pool.end());
