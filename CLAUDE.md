# CLAUDE.md

We're building the app described in @SPEC.MD. Read that file for general architectural tasks or to double-check the exact database structure, tech stack or application architecture.

Keep your replies extremely concise and focus on conveying the key information. No unnecessary fluff, no long code snippets.

Whenever working with any third-party library or something similar, you MUST look up the official documentation to ensure that you're working with up-to-date information.
Use the DocsExplorer subagent for efficient documentation lookup.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev          # Start development server (http://localhost:3000)
bun run build    # Build for production
bun run lint     # Run ESLint
bun start        # Start production server
```

## Architecture

This is a Next.js 16 application using the App Router pattern with:

- **Package Manager**: Bun (bun.lock present)
- **TypeScript**: Strict mode enabled
- **Styling**: Tailwind CSS 4 with PostCSS
- **React**: Version 19

### Key Dependencies

- `better-auth` - Authentication library
- `zod` - Schema validation
- Supabase Postgres via `pg` Pool (`lib/db.ts`) - rental properties, units, tenants, payment ledger, expenses. Local stack: `supabase start` (DB on port 54342); schema in `supabase/migrations/`

### Project Structure

- `app/` - Next.js App Router pages and layouts
- `@/*` path alias maps to project root

### Plan and Tasks

When asked to **build** a feature (anything beyond a trivial one-line fix), plan
before writing code:

1. Design the approach first — do not start editing until the plan is written.
2. Write the plan to a handover file at `docs/plans/<feature-name>.md` so another
   agent can pick up the work without this conversation's context. Each file must
   contain:
   - **Context** — the goal and why the change is being made
   - **Plan** — the implementation approach
   - **Tasks** — a checkboxed list (`- [ ]`) of discrete steps, each naming the
     file(s) it touches
3. As tasks are completed, check them off (`- [x]`) in the handover file.
