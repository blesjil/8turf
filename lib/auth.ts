import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { admin } from 'better-auth/plugins';

import { pool } from './db';
import {
  clearAttempts,
  getLockRemainingMs,
  lockoutMessage,
  normalizeEmail,
  recordFailedAttempt,
} from './login-lockout';

export const auth = betterAuth({
  database: pool,
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
      const remaining = await getLockRemainingMs(email);
      if (remaining > 0) {
        throw new APIError('TOO_MANY_REQUESTS', { message: lockoutMessage(remaining) });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/email') return;
      const email = normalizeEmail(ctx.body?.email);
      if (!email) return;
      if (ctx.context.returned instanceof APIError) {
        await recordFailedAttempt(email);
      } else {
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
