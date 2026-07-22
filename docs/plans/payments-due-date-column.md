# Payments Overview: Due Date column + Overdue status

## Context

The Billing report shows each charge's due date (lease-anniversary day, from
`anchorDueDate` in `lib/reports/charges.ts`). The Payments Overview page has no
due date column, so the user can't see when a tenant's rent for the selected
month falls due. Add the same derived due date to the payments table.

## Plan

No data-layer change needed: `OverviewRow` already carries `leaseStartDate`,
and `anchorDueDate(leaseStartDate, period)` is the exact derivation Billing
uses. Compute it inline in the page for active rows; vacant rows show "—".
Format with the shared `formatDate` helper to match the Billing report.
Column sits between Tenant and Rent, hidden on mobile (`hidden sm:table-cell`)
like the Rent column to keep the phone layout uncluttered.

## Plan (follow-up: Overdue status)

Mirror the Billing report's `chargeStatus` rule in `rowStatus`: a fully-unpaid
row past its due date is `overdue` ('unpaid' only on the due day itself,
'partial' stays 'partial'), so the two pages never disagree on a tenant.
Overdue rows stay reminder targets and count as unpaid in the dashboard
health buckets. New "Overdue" option in the status filter; red badge.

## Tasks

- [x] Add "Due date" header + cell rendering `formatDate(anchorDueDate(...))`
      for active rows in `app/payments/page.tsx`
- [x] Add `overdue` to `RowStatus`/`STATUS_FILTERS`, escalate in `rowStatus`,
      chase in `isReminderDue` (`lib/payments-summary.ts`)
- [x] Overdue badge variant + filter label (`components/payment-status-badge.tsx`,
      `components/payment-status-filter.tsx`)
- [x] Count overdue in dashboard unpaid bucket (`app/dashboard/page.tsx`)
- [x] Update `__tests__/lib/payments-summary.test.ts` for the new distinction
- [x] Verify with `bunx tsc --noEmit`, lint, and full vitest run
- [x] Live-test in the browser: due date column, Paid / Not yet due / Overdue /
      Inactive badges, and the Overdue filter (June + July 2026 data)
- [x] Grace period: `OVERDUE_GRACE_DAYS = 2` in `lib/reports/charges.ts` —
      a fully-unpaid charge stays "Unpaid" through 2 days past due, flips to
      "Overdue" on day 3; honored by chargeStatus, rowStatus, the Billing
      overdue count, and the Outstanding current/overdue split (the report's
      days-overdue column stays the factual day count)
