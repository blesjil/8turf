# Redesign — Direction B "Console"

Port the **Direction B "Console"** visual identity into the live app. Modern SaaS
(Linear/Stripe) feel — bright, spacious, KPI cards with sparklines and status pills —
while keeping the forest-green brand.

## Reference material (source of truth for look & values)

- Chosen mockup: `mockups/B-console.html`
- Direction index / rationale: `mockups/index.html`
- This plan: `docs/redesign-direction-b.md`

## Design tokens (already applied in T1 — do not re-derive)

Defined in `app/globals.css` `:root`:

| Token                  | Value               | Token             | Value                        |
| ---------------------- | ------------------- | ----------------- | ---------------------------- |
| `--background`         | `#FBFBFA`           | `--foreground`    | `#111813`                    |
| `--card` / `--popover` | `#FFFFFF`           | `--muted`         | `#F6F7F5`                    |
| `--border` / `--input` | `#EAECE9`           | `--primary`       | green `oklch(0.45 0.12 155)` |
| `--secondary`          | teal-blue `#2563A8` | `--warning`       | `#B4791E`                    |
| `--destructive`        | `#C33B3B`           | `--success-muted` | `#E7F2EC`                    |
| `--radius`             | `0.875rem` (14px)   | `--shadow-card`   | soft two-layer shadow        |

Fonts (`app/layout.tsx`, next/font): Inter → `--font-sans`, Inter Tight → `--font-heading`,
JetBrains Mono → `--font-mono`.

Mockup tint colors not yet tokenized (add to `globals.css` when a task needs them):
`--amber-100 #fbf0dc`, `--red-100 #fbe9e7`, `--blue-100 #e6eef7`, `--green-d #155c3c`.

## Task sequence

Bottom-up: tokens → primitives → composed cards → pages. Each task must end with
`bun run build` passing and no page-data changes unless the task says so.

### T1 — Foundation: fonts + tokens ✅ DONE

- `app/layout.tsx`: Geist → Inter / Inter Tight / JetBrains Mono.
- `app/globals.css`: Direction-B `:root` values, `--radius` 0.875rem, `--shadow-card`,
  `@theme` font stacks resolve the next/font vars. Kept `--primary` green.
- Note: set `--secondary-foreground: #FFFFFF` (dark text was unreadable on teal-blue).

### T2 — Direction-B primitives + header ✅ DONE

- `components/ui/card.tsx`: `ring` → `border border-border` + `shadow-[var(--shadow-card)]`,
  radius `xl` → `lg`.
- `components/ui/button.tsx`: primary darkens on hover (`color-mix … black 14%`) + card
  shadow; `outline` on `bg-card` with card shadow.
- `components/header.tsx`: `font-heading` wordmark, `bg-background/85 backdrop-blur-md`,
  active nav link `bg-success-muted text-primary`.

### T3 — Status pills + alerts ✅ DONE

Primitives only, no page/layout/data changes.

- `components/ui/badge.tsx`: base is now a true pill (`rounded-full`, `text-[11.5px]
font-semibold`). Added named status variants: `success` (`bg-success-muted text-primary`),
  `warning` (`bg-warning-muted text-warning`), `neutral` (`bg-muted text-muted-foreground`);
  `destructive` retinted to `bg-danger-muted text-destructive`.
- `components/payment-status-badge.tsx`: dropped the ad-hoc className tint map; now selects
  the named badge variant — paid→success, partial→warning, unpaid→destructive,
  inactive→neutral. Kept the leading status dot.
- `components/ui/alert.tsx`: base gets `border-border` + `--shadow-card`; `destructive`
  retinted (`bg-danger-muted border-destructive/20`); added a `warning` variant
  (`bg-warning-muted`).
- Judgment call: reused existing `--warning-muted` / `--danger-muted` tokens instead of
  adding `amber-100` / `red-100` — the app already had these light-tint tokens (T1 only
  changed `--success-muted`), so no new tokens were introduced.

### T4 — Dashboard composed cards ✅ DONE

Rebuilt the dashboard (`app/dashboard/page.tsx`) to the mockup body, all metrics from real
data — no invented numbers.

- `app/dashboard/page.tsx`: now fetches the property list **and** `getPaymentsOverview(period,
scope)` in parallel (period = current month), runs `summarizePayments` for portfolio KPIs,
  and builds per-property aggregates (collected, occupied, unpaid/partial counts) + health
  counts from the same paid-vs-rent math the Payments page uses. Title → "Portfolio".
- `components/property-list.tsx`: `.pcard` — gradient identity thumbnail (initials, hashed
  colour), name + address, T3 status pill (unpaid→destructive, partial→warning, else
  success), Collected/Units metarow, occupancy bar (green ≥90 / amber ≥70 / red).
  `PropertyListItem` gained `collected`, `occupied`, `unpaidUnits`, `partialUnits`.
- `components/kpi-card.tsx` (new): label + tinted icon chip + big `font-heading` value + foot.
  KPIs = Rent collected, Occupancy %, Outstanding, Vacant units. Icons from `lucide-react`.
- `components/health-strip.tsx` (new): segmented bar + legend (paid/partial/unpaid/vacant),
  colours matched to the T3 status semantics.
- `lib/money.ts`: added `formatCentsCompact` (e.g. "₱ 4.2M") for the KPI/metric tiles.

Judgment calls / omissions:

- **Sparklines and month-over-month deltas** ("▲ 6.4% vs June") from the mockup were
  **omitted** — there is no historical time series in the data layer, and faking a trend
  would violate "don't invent metrics". Add later only if a per-month history query is built.
- The mockup's "Overdue > 30d" KPI has no aging data behind it; replaced with **Vacant units**
  (real). The mockup's ok/due/late pills collapse to the data's paid/partial/unpaid.
- Verification: `bun run build`, `bun run lint`, and typecheck all pass. **Visual render not
  driven** — the dashboard is auth-gated and needs the local Supabase stack (DB :54342) plus a
  login; the data path reuses the already-tested `getPaymentsOverview` / `summarizePayments`.

**Redesign status:** core Direction-B port (tokens → primitives → status → dashboard) is
complete. Remaining app screens compose to the Console look one at a time in T5.

### T5 — Compose remaining screens to Console look ✅ DONE

Bounded, one screen per pass. Reuse T2–T4 primitives (`Card`, `Badge`, `Button`, `KpiCard`,
`HealthStrip`) and existing tokens — no hand-rolled colours, keep `--primary` green, every
number from real data.

- **T5a — Payments (`app/payments/page.tsx`) ✅ DONE.** Replaced the local `StatCard` with the
  shared `KpiCard` (icons + tones) for the five summary tiles; title now `font-heading`. Table
  logic, filters, reminders untouched. `bun run build` compiles clean.
- **T5b — Financial Report (`app/financial-report/page.tsx`) ✅ DONE.** Replaced the local
  `StatCard` with the shared `KpiCard` for the three summary tiles — Gross income
  (`WalletIcon`, green), Expenses (`ReceiptIcon`, amber), Net income (`TrendingUpIcon`, tone
  green/red by sign). Title now `font-heading`; tile grid gap tightened to `3.5` to match T5a.
  Financial calculations, queries, per-property tables and the per-property net-income line are
  untouched. `bun run build` + `bun run lint` pass (only pre-existing warning is in generated
  `coverage/`).
  Judgment calls: (1) kept the full `formatCents` for tile values (exact figures), matching
  T5a's choice over `formatCentsCompact` — the three-tile grid has room. (2) The old StatCard
  tinted the _value text_ green/red for net-income sign; KpiCard tints only the icon chip, so
  the sign signal now lives in the tile `tone` (green ≥0 / red <0) rather than coloured digits.
  No `foot` deltas added — there is no historical series (same rule as T4).
- **T5c — Property / Unit detail (`app/properties/[id]/*`) ✅ DONE.**
  - `app/properties/[id]/page.tsx`: title → `font-heading`; added a 4-tile `KpiCard` summary row
    from direct unit aggregates (Units → `Building2Icon` blue, Occupied → `UsersIcon` green,
    Vacant → `DoorOpenIcon` amber, Rent roll = Σ asking rent → `WalletIcon` green, foot "asking,
    all units"). Aggregates run over the full unit set, not the paginated slice. Section headings
    (`Units`, `Property Expenses`) → `font-heading`.
  - `app/properties/[id]/units/[unitId]/page.tsx`: section headings (`Current Tenant`, `Payment
Ledger`, `Unit Expenses`, `Tenancy History`) → `font-heading`. Kept the unit-label `h1` in
    `font-mono` — unit codes are mono throughout the app (`unit-list`, payment tables); switching
    it would break that identity.
  - Form/list titles set to `font-heading` for section consistency (title-only, no behaviour):
    `[id]/edit`, `[id]/units/[unitId]/edit`, `[id]/units/new`, `properties/new`,
    `properties/archived`.
  - Judgment calls / omissions: (1) **No `KpiCard` row on the unit page** — this-month status is
    already shown via the `PaymentStatusBadge` beside the ledger and asking rent sits in the
    subtitle; tiles would duplicate real data, not add it. (2) **`HealthStrip` not used** — its
    paid/partial/unpaid semantics need per-lease payment data, which neither detail page fetches;
    forcing it would mean inventing collection numbers (T4 rule). (3) These pages already sit on
    Console primitives (`UnitList`, `TenantCard`, `PaymentLedger`, `ExpenseList`, `Card`,
    `Badge`) from T2/T3, so the remaining gap was genuinely typographic plus the property KPI row.
  - Verify: `bun run build` + `bun run lint` pass (only pre-existing warning in generated
    `coverage/`). Visual render **not driven** — auth-gated, needs local Supabase (:54342) + login;
    no queries/calculations/form logic changed.

**T5 complete.** All target screens (dashboard T4, Payments T5a, Financial Report T5b, Property/
Unit detail T5c) are composed to the Console look. The full Direction-B port — tokens (T1) →
primitives + header (T2) → status pills/alerts (T3) → composed screens (T4/T5) — is done. Any
future screens follow the same pattern: `font-heading` titles, shared `KpiCard`/`Badge`/`Card`/
`Button`/`HealthStrip` primitives, tokens from `globals.css`, `--primary` green, every number real.

### Visual verification pass — 2026-07-19 ✅ DRIVEN

First time the Console screens were actually rendered in a browser (Playwright, local Supabase
:54342, dev server :3001, throwaway admin created then deleted — no real data touched). Screens
checked: Dashboard, Payments, Financial Report, Property detail, Unit detail, plus the auth
screen. All render the Console look: `font-heading` titles, `KpiCard` tiles with real figures in
tabular-nums, T3 status pills/badges, `--primary` green intact.

Findings:

- **Fixed — `KpiCard` `blue` tone icon was invisible.** The `blue` tone used
  `bg-secondary/10 text-secondary`, but `--secondary` (and thus the `text-secondary` utility)
  resolves to a near-white value at runtime in this Tailwind-v4 + `shadcn/tailwind.css` setup
  (the intended teal-blue `#2563a8` from `:root` is being shadowed — a T1/foundation-level token
  quirk, not chased here). Effect: the icon in every `blue`-tone tile (Dashboard "Occupancy",
  Property detail "Units") rendered as near-white on a pale chip — effectively missing. Fix: added
  dedicated `--info` / `--info-muted` tokens (`#2563a8` / `#e6eef7`, the plan's earmarked blue
  tint) + `--color-info*` theme mappings in `app/globals.css`, and repointed the `KpiCard` `blue`
  tone to `bg-info-muted text-info`. Verified in-browser: icon now computes to `rgb(37,99,168)`
  on `#e6eef7`. `bun run build` + `bun run lint` still pass.
- **Open (pre-existing, not T5) — hydration mismatch console error.** Emitted by the header user
  menu's `DropdownMenu` trigger (base-ui `MenuTrigger`); a known ID-generation SSR/client class,
  harmless but noisy. Lives in the T2 header/primitives, not the composed screens. Left as-is.
- **Note — `--secondary` / `text-secondary` is broken app-wide**, so other `variant="secondary"`
  consumers (e.g. the "Occupied" badge in `unit-list`) also don't get the intended teal-blue; they
  degrade to a legible light-gray pill. Worth a proper T1 token fix later, but out of scope for
  this pass.

## Follow-ups not in T1–T5

- **Sidebar navigation shell ✅ DONE (2026-07-19).** The mockup's defining layout element — the
  persistent left sidebar (`<aside class="side">` in `mockups/B-console.html`) — had never been
  ported; T2 only restyled the top header. Built it as `components/app-shell.tsx` (client): a
  240px sticky left column on desktop, a slide-over drawer + scrim on mobile (`< lg`) with a
  hamburger top bar. Grouped nav (Overview → Dashboard; Money → Payments, Financial Report;
  Admin[admin-only] → Archived properties, Manage users) using `lucide` icons and the T2 active
  style (`bg-success-muted text-primary`). Bottom account block: gradient initials avatar
  (`from-primary to-secondary`), name/email, Log out. Wired into `app/layout.tsx`: authenticated
  users get `<AppShell>`, public pages (landing, `/authenticate`) keep the plain `Header`.
  Judgment calls: (1) **only real routes** — the mockup's Units/Reports/Expenses/Tenants/Settings
  links were dropped (no such pages). (2) The mockup's **⌘K search** and **"Invite teammate"
  upsell** were omitted — no search backend or invite flow exists, and faking them violates the
  redesign's "nothing invented" rule; the account block replaces the upsell slot. (3) Drawer
  closes on nav via per-link `onClick` (kept the pathname→`setState` effect out to satisfy the
  repo's `react-hooks/set-state-in-effect` lint error). Verify: `bun run build` + `bun run lint`
  pass; **driven in-browser** (Playwright, local Supabase :54342, dev :3001, existing admin) —
  confirmed desktop sticky sidebar, mobile drawer + scrim, active-link tracking, close-on-navigate,
  and logout on Dashboard + Payments.
- **Un-redesigned screens ✅ DONE (2026-07-19).** `app/admin/users/page.tsx` "Manage Users" title
  and `app/authenticate/page.tsx` "Sign in to 8TURF" `CardTitle` → `font-heading`. Both pages were
  already on Console primitives (Card/Table/Badge/Alert/Button), so this was title-only, no
  behaviour change. `bun run build` + `bun run lint` pass. **Every app screen now carries the
  Console look.**
- **Root palette-shadowing fix ✅ DONE (2026-07-19).** Root cause: the shadcn **`base-nova`**
  style (`components.json` → injected via `shadcn/tailwind.css` / its `dist/index.js` runtime)
  ships its own **unlayered `:root` palette** (`--secondary: #f2f3ef` grey, `--secondary-foreground:
#27382c`, plus its own `--background #fafaf8` / `--foreground #1c221d` / `--muted #f2f3ef` /
  `--accent` / green `--primary`). Being an unlayered `:root` (specificity 0,1,0), it outranked the
  Direction-B `:root` palette in `app/globals.css` — most tokens were near-identical so it went
  unnoticed, but `--secondary` was starkly wrong (grey vs teal-blue), which is what made
  `text-secondary` / the `KpiCard` blue-tone icon fail. Fix: bumped the Direction-B palette's own
  selector from `:root` to **`:root:root`** (specificity 0,2,0, still unlayered) in
  `app/globals.css`, so the **entire** app palette — not just `--secondary` — wins over base-nova.
  Verified in-browser that `--background #fbfbfa`, `--foreground #111813`, `--secondary #2563a8`,
  `--muted #f6f7f5`, `--info`/`--info-muted`, and `--primary` (oklch green) all now resolve to the
  Direction-B values; `variant="secondary"` badges (e.g. `unit-list` "Occupied") render as a clean
  teal-blue pill with white text — the original T1 intent. `bun run build` + `bun run lint` pass.
  (The `KpiCard` `blue` tone still uses the dedicated `--info` tokens — semantically its own accent
  — rather than depending on `secondary`.)

## Handoff convention

When finishing a task, mark it DONE here (files touched + any judgment calls), then hand the
next agent a prompt that points to this file. Reference paths, not conversation memory.

## T5c handoff prompt

> Do Task T5c (Property / Unit detail → Console look), part of the 8turf Direction-B "Console"
> redesign.
>
> Read first: `docs/redesign-direction-b.md` (this file) — full T1–T5b history, applied design
> tokens, reusable primitives, and judgment calls. Reference mockup: `mockups/B-console.html`.
>
> Context: Foundation is complete — tokens/fonts (T1), card/button primitives + header (T2),
> status pills/alerts (T3), dashboard (T4), Payments (T5a), Financial Report (T5b). The
> established pattern for composing a screen: swap bespoke stat tiles for the shared `KpiCard`,
> set page titles to `font-heading`, lean on the `Card`/`Badge`/`Button` primitives (and
> `PaymentStatusBadge` / `HealthStrip` where they fit), and never hand-roll colours — use the
> tokens in `app/globals.css`. Keep `--primary` green.
>
> Task — compose the Property/Unit detail screens under `app/properties/[id]/*` to the Console
> look:
>
> 1. Read the screens first to learn their current structure and, critically, what real data
>    they already have. Files: `app/properties/[id]/page.tsx` (property detail),
>    `app/properties/[id]/units/[unitId]/page.tsx` (unit detail), plus the `edit`/`new` form
>    pages under those paths. Do not invent metrics or trends — no fake sparklines or
>    month-over-month deltas (this rule held through T4/T5a/T5b).
> 2. Reuse shared components: `components/kpi-card.tsx`
>    (`KpiCard({ label, value, foot?, icon, tone })`, tone ∈ green|blue|amber|red; lucide icons
>    are Icon-suffixed, e.g. `WalletIcon`, `Building2Icon`, `BanknoteIcon`, `ReceiptIcon`);
>    `lib/money.ts` (`formatCents` full, `formatCentsCompact` "₱ 4.2M");
>    `components/payment-status-badge.tsx` for lease status; `components/health-strip.tsx` if an
>    occupancy/payment breakdown is shown. `Card`/`Badge`/`Button` already carry Console styling.
> 3. Set page title(s) to `font-heading`; use `tabular-nums` for figures.
> 4. Presentation only — do not change queries, calculations, form logic, or numbers. Watch for
>    the many form/edit pages under these routes; keep their behaviour intact.
>
> Verify: `bun run build` and `bun run lint` must pass. Visual render is auth-gated and needs
> local Supabase (DB :54342) + a login — if you can't drive it, say so honestly rather than
> claiming a check you didn't run.
>
> When done: in this plan file, mark T5c DONE (files touched + judgment calls/omissions), flip
> its status marker, and note whether T5 is now complete (all screens composed) or what remains.
