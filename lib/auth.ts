import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { admin } from 'better-auth/plugins';

import { pool } from './db';
import { clearAttempts, lockoutMessage, normalizeEmail, registerAttempt } from './login-lockout';

export const auth = betterAuth({
  database: pool,
  // In production set BETTER_AUTH_URL to the deployed origin; unset locally,
  // better-auth infers the base URL from the request (fine for localhost).
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 10, // sliding 10-minute idle window
    updateAge: 60,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/email') return;
      const email = normalizeEmail(ctx.body?.email);
      if (!email) return;
      // Consume the attempt atomically before checking the password, so
      // concurrent requests for the same email serialize on the DB row lock
      // instead of all slipping past the lock check before any of them
      // records a failure. Cleared on success in the `after` hook below.
      const { locked, remainingMs } = await registerAttempt(email);
      if (locked) {
        throw new APIError('TOO_MANY_REQUESTS', { message: lockoutMessage(remainingMs) });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/email') return;
      const email = normalizeEmail(ctx.body?.email);
      if (!email) return;
      if (!(ctx.context.returned instanceof APIError)) {
        await clearAttempts(email);
      }
    }),
  },
  plugins: [
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),
    nextCookies(),
  ],
});
