import { describe, it, expect } from 'vitest';
import {
  createUserSchema,
  promoteToAdminSchema,
  createPropertySchema,
  createUnitSchema,
  assignTenantSchema,
  recordPaymentSchema,
} from '@/lib/validation';

describe('createUserSchema', () => {
  it('passes with valid email and name', () => {
    const result = createUserSchema.safeParse({
      email: 'new-user@example.com',
      name: 'New User',
    });
    expect(result.success).toBe(true);
  });

  it('fails with invalid email', () => {
    const result = createUserSchema.safeParse({
      email: 'not-an-email',
      name: 'New User',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toContain('Invalid email address');
    }
  });

  it('fails with empty name', () => {
    const result = createUserSchema.safeParse({
      email: 'new-user@example.com',
      name: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeDefined();
    }
  });

  it('fails with name > 200 chars', () => {
    const result = createUserSchema.safeParse({
      email: 'new-user@example.com',
      name: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain('Name is too long');
    }
  });
});

describe('promoteToAdminSchema', () => {
  it('passes with a non-empty user id', () => {
    const result = promoteToAdminSchema.safeParse({ userId: 'user-123' });
    expect(result.success).toBe(true);
  });

  it('fails with an empty user id', () => {
    const result = promoteToAdminSchema.safeParse({ userId: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.userId).toBeDefined();
    }
  });
});

describe('createPropertySchema', () => {
  it('accepts a valid property', () => {
    const result = createPropertySchema.safeParse({ name: 'Maple House', address: '123 Main St' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = createPropertySchema.safeParse({ name: '', address: '123 Main St' });
    expect(result.success).toBe(false);
  });
});

describe('createUnitSchema', () => {
  it('accepts a valid unit and coerces numeric fields', () => {
    const result = createUnitSchema.safeParse({
      propertyId: 'prop-1',
      unitLabel: 'Unit 2B',
      bedrooms: '2',
      bathrooms: '1.5',
      rentAmount: '150000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bedrooms).toBe(2);
      expect(result.data.rentAmount).toBe(150000);
    }
  });

  it('rejects a negative rent amount', () => {
    const result = createUnitSchema.safeParse({
      propertyId: 'prop-1',
      unitLabel: 'Unit 2B',
      bedrooms: '2',
      bathrooms: '1',
      rentAmount: '-100',
    });
    expect(result.success).toBe(false);
  });
});

describe('assignTenantSchema', () => {
  it('accepts a tenant with an open-ended lease', () => {
    const result = assignTenantSchema.safeParse({
      unitId: 'unit-1',
      name: 'Jane Tenant',
      email: '',
      phone: '',
      rentAmount: '150000',
      leaseStartDate: '2026-01-01',
      leaseEndDate: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed lease start date', () => {
    const result = assignTenantSchema.safeParse({
      unitId: 'unit-1',
      name: 'Jane Tenant',
      rentAmount: '150000',
      leaseStartDate: '01/01/2026',
    });
    expect(result.success).toBe(false);
  });
});

describe('recordPaymentSchema', () => {
  it('accepts a valid payment', () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: 'tenant-1',
      amount: '75000',
      period: '2026-03',
      paidDate: '2026-03-05',
      method: 'cash',
      notes: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a zero amount', () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: 'tenant-1',
      amount: '0',
      period: '2026-03',
      paidDate: '2026-03-05',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed period', () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: 'tenant-1',
      amount: '75000',
      period: '2026-3',
      paidDate: '2026-03-05',
    });
    expect(result.success).toBe(false);
  });
});
