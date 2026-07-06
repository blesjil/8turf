import { auth } from '@/lib/auth';
import { pool } from '@/lib/db';
import { generateTempPassword } from '@/lib/generate-password';

const email = process.argv[2];
const name = process.argv[3];

if (!email || !name) {
  console.error('Usage: bun run scripts/create-admin.ts <email> <name>');
  process.exit(1);
}

const password = generateTempPassword();

const result = await auth.api.createUser({
  body: { email, name, password, role: 'admin' },
  // No `headers` here — intentionally invoked outside request scope so the
  // admin-permission check in better-auth's endpoint is skipped for this
  // one-time bootstrap of the very first admin account.
});

console.log(`Admin user created: ${result.user.email} (id: ${result.user.id})`);
console.log(`Temporary password (relay this to the admin, then have them change it): ${password}`);

await pool.end();
