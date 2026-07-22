# Reports — Phase 1

## Context

**Goal:** Add rental reports to 8turf per `docs/8TURF_Reports_High_Level_Design.md`, without redesigning the lease/billing/payment/tenant modules.

**Key finding (current-state assessment):** 8turf is a _derived-coverage ledger_, not an accounts-receivable/billing system.

- There is **no bill/invoice entity and no `due_date`** anywhere. Rent owed is derived: `tenant.rent_amount` × the months an active lease covers.
- `rent_payments` stores a coverage range (`period_start`/`period_end`) + a derived `period` (YYYY-MM), plus `paid_date`, `amount`, `method`, `notes`, `payment_type` (`deposit`/`advance`/`reservation`/`rental`). Allocation of a payment across months is _computed_ (`creditsByPeriod`), never stored.
- Leases live on `tenants` (`lease_start_date`, `lease_end_date`, `is_active`, one active tenant per unit); `units.rent_amount` is the asking rent.

**Decisions (locked with the user):**

1. **Derived charges, no schema change.** Represent "rent due" by computing monthly charges on the fly. Honors `SPEC.MD`'s derived-ledger design; no migration, no charge-generation job.
2. **Scope = Phase 1 essentials only:** Dashboard, Billing, Collections, Outstanding Rent, Tenant Ledger, Occupancy. (Aging, Advance Payments, Rental Coverage → Phase 2.)
3. **Exports deferred** (CSV/Excel/PDF → Phase 2). Build report views only.
4. **Due-date convention = lease-anchor day:** rent for a covered month is due on the lease's day-of-month (`lease_start_date` day, clamped to month length), aligning with the existing coverage anchoring in `coveredPeriods()`.
5. **Plan location:** `docs/plans/` per CLAUDE.md.
6. **Access = admin-only**, matching the existing Financial Report gate; `ownerScope` wired through queries so opening it to scoped managers later is trivial.

## Plan

### Architecture — one shared charge engine, six views

A single module derives monthly rent charges from leases + the ledger. Dashboard and every detail report read from it, so totals reconcile by construction (acceptance criterion #11). No new tables; reuses `lib/payment-status.ts` and `lib/payments-overview.ts` primitives.

#### `lib/reports/charges.ts` (pure functions, unit-tested)

For a scope (`ownerScope` string | null) and a period range, emit one **charge** per active lease per covered month:

- `amount` = tenant `rent_amount`
- `dueDate` = lease-anchor day: day-of-month of `lease_start_date`, clamped to the charge month's length (e.g. lease starts Jan 31 → Feb charge due Feb 28/29)
- `creditsApplied` = sum of `creditForPeriod(payment, period)` over the tenant's `rental`+`advance` payments overlapping that month
- `outstanding` = `max(0, amount − creditsApplied)`
- `status`: `paid` | `partial` | `unpaid` | `advance` | `overdue`, derived from credits, `dueDate`, and the as-of date

Reuses: `coveredPeriods`, `creditForPeriod`, `isLeaseActiveForPeriod` (`lib/payment-status.ts`); occupant-collapsing via `pickOccupant` (`lib/payments-overview.ts`). Month filters use inclusive-start / exclusive-end (`date >= start AND date < endExclusive`) per design doc §5.

### The six reports (routes under `app/reports/`)

| Report        | Route                    | Date basis              | Source / notes                                                                                                                              |
| ------------- | ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard     | `/reports`               | mixed (labeled per KPI) | Engine KPIs + occupancy; each KPI drills to the matching report                                                                             |
| Billing       | `/reports/billing`       | Due Date                | Charges grouped by due month; a July charge appears in July even if paid in June                                                            |
| Collections   | `/reports/collections`   | Payment Date            | `rent_payments` filtered by `paid_date`; classification (advance / on-time / late / partial) derived from `paid_date` vs `dueDate` + amount |
| Outstanding   | `/reports/outstanding`   | Due Date + As-of        | Charges with `outstanding > 0` evaluated at the as-of date                                                                                  |
| Tenant Ledger | `/reports/tenant-ledger` | Transaction Date        | Charges (debit) + payments (credit) interleaved by date with a running balance; positive = tenant owes, negative = credit                   |
| Occupancy     | `/reports/occupancy`     | Lease overlap           | Units + lease-period overlap; reuses existing occupancy/vacancy logic                                                                       |

Report-specific logic lives in `lib/reports/<report>.ts` as pure functions consuming the engine output; the `page.tsx` files only fetch + render.

### Shared UI (`components/reports/`)

- `<ReportHeader>` — renders report name, reporting period, **date basis**, and as-of date (when applicable) on every page → acceptance #10. Structured so exports can reuse it in Phase 2.
- `<ReportFilters>` — URL-searchParam driven (`month`/range, `property`, `unit`, `tenant`, `asOf`). Each report passes which filters are relevant; irrelevant filters are not rendered (design doc §4).
- Rows drill down to existing detail pages (tenant/unit/payment) — no new transaction-management screens (acceptance #13, design doc §9).
- Reuse existing primitives: `FinancialPeriodPicker`/`month-picker`, `KpiCard`, `ui/table`, `PageContainer`, `formatCents`, `format-date`.

### Nav & access

- Add a **Reports** `NavGroup` in `components/app-shell.tsx` (`buildGroups`) with the six items, admin-gated. Leave the existing Money group (Payments, Financial Report) untouched (acceptance #14).
- Each `page.tsx` gates with `session.user.role === 'admin'` → `notFound()` (mirrors `app/financial-report/page.tsx`), and threads `ownerScope(session)` into queries.

### Testing

`vitest` unit tests (in `__tests__/lib/reports/`, mirroring existing convention) for the pure engine + per-report functions (no DB): charge derivation, lease-anchor due-date + clamping, month-boundary inclusivity, payment classification, outstanding-at-as-of, ledger running balance, occupancy/vacancy counts. Run with `bun run test:run`.

### Explicitly out of scope (Phase 2)

Exports (CSV/Excel/PDF); Aging, Advance Payment, and Rental Coverage reports; historical comparison.

## Tasks

### Engine + shared logic

- [x] `lib/reports/charges.ts` — derive monthly charges (amount, lease-anchor due date, credits, outstanding, status) from leases + ledger; reuse `payment-status.ts` primitives
- [x] `__tests__/lib/reports/charges.test.ts` — unit tests: derivation, due-date anchoring + month-length clamping, month-boundary inclusivity, status transitions
- [x] `lib/reports/period.ts` — shared month→`{start, endExclusive}` + as-of helpers (or extend `lib/financial-report.ts` if a natural fit)

### Shared UI

- [x] `components/reports/report-header.tsx` — name / period / date-basis / as-of banner
- [x] `components/reports/report-filters.tsx` — URL-param filter bar; renders only the filters a report declares relevant

### Reports

- [x] `app/reports/page.tsx` — KPI dashboard with drill-down links; composes `summarizeBilling` + `summarizeCollections` + occupancy (no separate lib needed)
- [x] `app/reports/billing/page.tsx` + `lib/reports/billing.ts` — charges grouped by due date, with summary totals + statuses
- [x] `app/reports/collections/page.tsx` + `lib/reports/collections.ts` — payments by `paid_date` with derived classification + summary
- [x] `app/reports/outstanding/page.tsx` + `lib/reports/outstanding.ts` — unpaid/partial charges at the as-of date
- [x] `app/reports/tenant-ledger/page.tsx` + `lib/reports/tenant-ledger.ts` — debit/credit ledger with running balance; tenant/lease/unit filter
- [x] `app/reports/occupancy/page.tsx` + `lib/reports/occupancy.ts` — occupied/vacant units by lease overlap + occupancy-rate summary
- [x] Per-report unit tests in `__tests__/lib/reports/*.test.ts` (classification, outstanding-at-as-of, running balance, occupancy counts)

### Integration

- [x] `components/app-shell.tsx` — add admin-gated **Reports** nav group (six items); leave Money group unchanged
- [x] Wire KPI drill-down links (Dashboard → Collections / Outstanding / Occupancy / Billing)
- [x] Verify drill-down from report rows to existing tenant/unit/payment detail pages
- [x] `bun run lint` + `bun run test:run` green; verify Dashboard totals reconcile with detail reports

```

```
