import { auth } from '@/lib/auth';
import { pool } from '@/lib/db';

const email = 'jill.palattao@gmail.com';
const password = 'admin1234';
const name = 'Jill Palattao';

const existing = await pool.query('select id from "user" where email = $1', [email]);

if (existing.rows.length > 0) {
  const userId = existing.rows[0].id;
  await pool.query('delete from session where "userId" = $1', [userId]);
  await pool.query('delete from account where "userId" = $1', [userId]);
  await pool.query('delete from "user" where id = $1', [userId]);
  console.log(`Removed existing user row(s) for ${email}, recreating...`);
}

const result = await auth.api.createUser({
  body: { email, name, password, role: 'admin' },
});

console.log(`User ready: ${result.user.email} (id: ${result.user.id}, role: admin)`);
console.log(`Password: ${password}`);

await pool.end();
