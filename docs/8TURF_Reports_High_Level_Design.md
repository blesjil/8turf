# 8TURF Rental Reports Enhancement – High-Level Design

## 1. Objective

Enhance the existing **8TURF application** by adding or improving rental reports without redesigning the current lease, billing, payment, or tenant modules.

The AI agent must first inspect the existing application and determine how the current data model can support the required reports.

The goal is to introduce clear reporting views for:

- Rental charges due
- Payments collected
- Outstanding balances
- Advance payments
- Partial payments
- Rental coverage periods
- Tenant account history
- Occupancy and vacancy

The reporting design must avoid assigning all transactions to a month using only one date.

---

# 2. Reporting Principles

Each report must use the correct date basis.

```text
Billing Report
= Due Date

Collections Report
= Payment Date

Rental Coverage Report
= Coverage Period Overlap

Outstanding Report
= Due Date plus As-of Date

Aging Report
= Due Date plus As-of Date

Occupancy Report
= Lease Period Overlap
```

Every report page and exported file must clearly display its date basis.

Example:

```text
Monthly Collections Report
Reporting Period: July 1–31, 2026
Date Basis: Payment Date
```

---

# 3. Required Reports

## 3.1 Reports Dashboard

### Purpose

Provide a quick summary of rental business performance for the selected period.

### Recommended KPIs

- Total Units
- Occupied Units
- Vacant Units
- Occupancy Rate
- Total Rent Due
- Total Collected
- Total Outstanding
- Collection Rate
- Advance Payments Received
- Partial Payments
- Overdue Accounts

### Recommended Filters

- Property
- Building
- Month or custom date range
- Unit
- Tenant

### Drill-Down Behavior

Each KPI should open the related detailed report.

Examples:

```text
Total Collected
-> Opens Collections Report

Total Outstanding
-> Opens Outstanding Rent Report

Occupied Units
-> Opens Occupancy Report
```

---

## 3.2 Monthly Billing Report

### Purpose

Show all rental bills or rent charges due during the selected period.

### Date Basis

```text
Due Date
```

### Main Business Question

> How much rent was due during this month?

### Recommended Columns

- Bill or Rental Reference
- Unit
- Tenant
- Rental Coverage
- Billing Date
- Due Date
- Rent Amount
- Other Charges
- Total Due
- Amount Paid
- Outstanding Balance
- Payment Status
- Payment Timing

### Recommended Statuses

- Paid
- Paid in Advance
- Partially Paid
- Unpaid
- Overdue

### Recommended Summary

- Total Bills
- Total Amount Due
- Amount Paid
- Amount Outstanding
- Number Paid in Advance
- Number Partially Paid
- Number Overdue

### Important Behavior

A July bill must appear in the July Billing Report even when it was paid in June.

---

## 3.3 Monthly Collections Report

### Purpose

Show all payments actually received during the selected period.

### Date Basis

```text
Payment Date
```

### Main Business Question

> How much money was received during this month?

### Recommended Columns

- Receipt or Payment Reference
- Payment Date
- Tenant
- Unit
- Amount Received
- Payment Method
- Reference Number
- Related Rental Coverage
- Related Due Date
- Amount Applied
- Unallocated Credit
- Payment Classification
- Received By

### Payment Classifications

- Advance Payment
- On-Time Payment
- Late Payment
- Partial Payment
- Unallocated Credit

### Recommended Summary

- Total Payments Received
- Total Amount Collected
- Total Applied to Rent
- Total Unallocated Credit
- Advance Payments
- Late Payments
- Payments by Method

### Important Behavior

A payment received in June for July rent must appear in the June Collections Report.

---

## 3.4 Outstanding Rent Report

### Purpose

Show unpaid or partially paid rental balances.

### Date Basis

```text
Due Date plus As-of Date
```

### Main Business Question

> Which tenants still owe rent as of a selected date?

### Recommended Columns

- Unit
- Tenant
- Rental Coverage
- Due Date
- Original Amount
- Amount Paid
- Outstanding Balance
- Days Overdue
- Current Status
- Last Payment Date
- Contact Details

### Recommended Filters

- As-of Date
- Property
- Unit
- Tenant
- Status
- Minimum Outstanding Amount
- Days Overdue Range

### Recommended Summary

- Total Outstanding
- Number of Tenants with Balance
- Current Outstanding
- Overdue Outstanding
- Oldest Unpaid Account

---

## 3.5 Aging Report

### Purpose

Group outstanding balances based on how long they have been overdue.

### Date Basis

```text
Due Date compared with As-of Date
```

### Recommended Aging Buckets

- Current or Not Yet Due
- 1–30 Days Overdue
- 31–60 Days Overdue
- 61–90 Days Overdue
- More Than 90 Days Overdue

### Recommended Columns

- Tenant
- Unit
- Current
- 1–30 Days
- 31–60 Days
- 61–90 Days
- Over 90 Days
- Total Outstanding

### Recommended Summary

- Total Receivables
- Total Current
- Total Overdue
- Highest Aging Bucket
- Number of Delinquent Tenants

### Important Behavior

Use the remaining unpaid balance, not the original bill amount.

---

## 3.6 Advance Payment Report

### Purpose

Show rent payments received before the related due date.

### Date Basis

Primary filter:

```text
Payment Date
```

Optional secondary filter:

```text
Related Due Date
```

### Main Business Question

> Which tenants have paid future rental periods in advance?

### Recommended Columns

- Payment Date
- Tenant
- Unit
- Amount Received
- Related Rental Coverage
- Related Due Date
- Amount Applied
- Number of Periods Paid Ahead
- Remaining Tenant Credit

### Recommended Summary

- Total Advance Payments
- Number of Tenants Paid Ahead
- Total Future Rent Covered
- Total Unallocated Advance Credit

---

## 3.7 Rental Coverage Report

### Purpose

Show rental periods that overlap the selected date range.

### Date Basis

```text
Rental Coverage Period
```

### Overlap Rule

```text
Coverage Start < Selected End
AND
Coverage End > Selected Start
```

### Main Business Question

> Which rental periods cover any part of the selected month?

### Recommended Columns

- Unit
- Tenant
- Coverage Start
- Coverage End
- Due Date
- Rent Amount
- Payment Status
- Payment Date
- Outstanding Balance

### Important Behavior

The following periods must appear in a July report:

```text
June 15–July 15
June 30–July 30
July 1–August 1
July 30–August 30
```

---

## 3.8 Tenant Ledger Report

### Purpose

Show the complete financial history of a tenant.

### Main Business Question

> What charges, payments, credits, and balances belong to this tenant?

### Recommended Columns

- Transaction Date
- Transaction Type
- Reference Number
- Description
- Rental Coverage
- Debit
- Credit
- Running Balance
- Status

### Transaction Types

- Rent Charge
- Utility Charge
- Penalty
- Payment
- Credit
- Refund
- Adjustment

### Recommended Behavior

- Positive running balance means the tenant owes money.
- Negative running balance means the tenant has available credit.
- Allow filtering by lease or unit.
- Allow export to PDF or CSV.

---

## 3.9 Occupancy Report

### Purpose

Show occupied and vacant units during the selected period.

### Date Basis

```text
Lease Period Overlap
```

### Recommended Columns

- Property
- Unit
- Tenant
- Lease Start
- Lease End
- Current Rental Coverage
- Unit Status
- Monthly Rent

### Recommended Summary

- Total Units
- Occupied Units
- Vacant Units
- Reserved Units
- Units Under Maintenance
- Occupancy Rate

---

# 4. Common Report Filters

The AI agent should reuse existing application filters and data structures where possible.

Recommended common filters:

- Property
- Building
- Unit
- Tenant
- Date Range
- Month
- Status
- Payment Method
- Bill Type
- Include Voided or Cancelled Records
- As-of Date
- Export Format

Do not display irrelevant filters on every report.

Example:

```text
Collections Report
- Payment Date
- Payment Method
- Tenant
- Unit

Billing Report
- Due Date
- Bill Status
- Tenant
- Unit
```

---

# 5. Monthly Filter Behavior

When a user selects a month, the system should convert it to an inclusive start and exclusive end range.

Example:

```text
Selected Month: July 2026

Start Date:
July 1, 2026

End Date Exclusive:
August 1, 2026
```

Recommended query pattern:

```sql
date_field >= :startDate
AND date_field < :endDateExclusive
```

This avoids duplicate records and time boundary issues.

---

# 6. As-of Date Behavior

Reports involving balances must support an `As-of Date`.

Applicable reports:

- Billing Report
- Outstanding Rent Report
- Aging Report
- Tenant Ledger

Example:

```text
Reporting Month: June 2026
As-of Date: June 30, 2026
```

This shows what was unpaid at the end of June.

The application may optionally also show:

```text
Outstanding as of June 30
Current Outstanding
```

This allows historical and current balances to be compared.

---

# 7. Suggested Report Navigation

Recommended Reports menu:

```text
Reports
├── Dashboard
├── Billing
├── Collections
├── Outstanding Rent
├── Aging
├── Advance Payments
├── Rental Coverage
├── Tenant Ledger
└── Occupancy
```

For a simpler first release:

```text
Reports
├── Dashboard
├── Billing
├── Collections
├── Outstanding Rent
├── Tenant Ledger
└── Occupancy
```

The Aging, Advance Payment, and Coverage reports may be added in a later phase.

---

# 8. Export Requirements

Recommended export formats:

- CSV
- Excel
- PDF

Every export must include:

- Report Name
- Property
- Selected Period
- Date Basis
- As-of Date, when applicable
- Generated Date and Time
- Generated By
- Applied Filters
- Summary Totals

Export values must match the values displayed in the application.

---

# 9. Drill-Down Requirements

Reports should support navigation to existing application records.

Examples:

```text
Click Tenant
-> Open Tenant Details

Click Unit
-> Open Unit Details

Click Bill
-> Open Rental Bill or Rental Record

Click Payment
-> Open Payment Details

Click Outstanding Amount
-> Open Related Charges and Payments
```

The reporting module should reuse existing detail pages instead of duplicating transaction-management screens.

---

# 10. Integration Guidance for the Existing Application

The AI agent must first analyze the current 8TURF implementation.

The analysis should identify:

1. Existing rental, lease, billing, and payment entities.
2. Existing date fields and their current meanings.
3. How rental coverage is currently stored.
4. How payment date is currently stored.
5. Whether payments are linked to one or multiple rental periods.
6. Whether partial and advance payments are already supported.
7. Existing report pages and filters.
8. Existing dashboard calculations.
9. Existing export functionality.
10. Existing tenant ledger or transaction history.
11. Existing unit occupancy logic.
12. Gaps that prevent accurate reporting.

The AI agent should not redesign the entire application unless the current model cannot support the report requirements.

---

# 11. AI Agent Deliverables

Before implementing changes, the AI agent must provide:

## 11.1 Current-State Assessment

- Existing reports
- Existing filters
- Current date basis used
- Current data sources
- Current limitations

## 11.2 Gap Analysis

For each required report:

- Available data
- Missing data
- Incorrect or ambiguous date fields
- Required backend changes
- Required frontend changes
- Migration impact

## 11.3 Proposed Report Plan

For each report:

- Report purpose
- Data source
- Date basis
- Filters
- Columns
- Summary KPIs
- Drill-down behavior
- Export behavior
- Access permissions

## 11.4 Implementation Plan

The implementation plan should be divided into:

1. Backend report queries
2. API endpoints
3. Frontend report pages
4. Shared filters
5. Dashboard integration
6. Export support
7. Security
8. Testing
9. Rollout

---

# 12. Recommended Implementation Priority

## Phase 1 – Essential Reports

1. Reports Dashboard
2. Monthly Billing Report
3. Monthly Collections Report
4. Outstanding Rent Report
5. Tenant Ledger
6. Occupancy Report

## Phase 2 – Enhanced Reports

1. Aging Report
2. Advance Payment Report
3. Rental Coverage Report
4. Detailed collection analysis
5. Historical comparison

---

# 13. Acceptance Criteria

The report enhancement is complete when:

1. Billing reports are filtered by due date.
2. Collections reports are filtered by payment date.
3. Advance payments appear in the month received.
4. Future rental bills still appear in their correct due month.
5. Partial payments show the correct remaining balance.
6. Outstanding reports support an as-of date.
7. Aging is based on the unpaid balance.
8. Coverage reports use overlap logic.
9. Occupancy reports use lease-period overlap.
10. Every report clearly displays its date basis.
11. Dashboard totals reconcile with detailed reports.
12. Exported results match the UI.
13. Report rows can drill down to existing tenant, unit, rental, or payment records.
14. Existing application functionality remains unchanged unless required for reporting accuracy.

---

# 14. Final Reporting Rule Summary

```text
Monthly Billing
= Group by Due Date

Monthly Collections
= Group by Payment Date

Advance Payment
= Payment Date is earlier than the related Due Date

Outstanding Balance
= Amount Due minus Payments Applied

Aging
= As-of Date minus Due Date

Rental Coverage
= Coverage period overlaps selected period

Occupancy
= Lease period overlaps selected period
```

This design allows the existing 8TURF application to add reliable rental reports without requiring a full system redesign.
