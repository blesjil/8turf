import { describe, it, expect } from 'vitest';
import {
  createUserSchema,
  promoteToAdminSchema,
  createPropertySchema,
  createUnitSchema,
  assignTenantSchema,
  recordPaymentSchema,
  validateDocumentFile,
  MAX_DOCUMENT_BYTES,
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

  it('rejects a lease end date before the lease start date', () => {
    const result = assignTenantSchema.safeParse({
      unitId: 'unit-1',
      name: 'Jane Tenant',
      rentAmount: '150000',
      leaseStartDate: '2026-07-15',
      leaseEndDate: '2026-07-10',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.leaseEndDate).toBeTruthy();
    }
  });
});

describe('recordPaymentSchema', () => {
  it('accepts a valid payment', () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: 'tenant-1',
      amount: '75000',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      paidDate: '2026-03-05',
      paymentType: 'rental',
      method: 'cash',
      notes: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a zero amount', () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: 'tenant-1',
      amount: '0',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      paidDate: '2026-03-05',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed period start', () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: 'tenant-1',
      amount: '75000',
      periodStart: '2026-03',
      periodEnd: '2026-03-31',
      paidDate: '2026-03-05',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a period end before the period start', () => {
    const result = recordPaymentSchema.safeParse({
      tenantId: 'tenant-1',
      amount: '75000',
      periodStart: '2026-03-31',
      periodEnd: '2026-03-01',
      paidDate: '2026-03-05',
      paymentType: 'rental',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.periodEnd).toBeTruthy();
    }
  });
});

describe('validateDocumentFile', () => {
  it('accepts a small PDF', () => {
    expect(validateDocumentFile({ size: 1024, type: 'application/pdf' })).toBeNull();
  });

  it('accepts an image at exactly the size limit', () => {
    expect(validateDocumentFile({ size: MAX_DOCUMENT_BYTES, type: 'image/jpeg' })).toBeNull();
  });

  it('rejects an empty file', () => {
    expect(validateDocumentFile({ size: 0, type: 'application/pdf' })).toMatch(/empty/);
  });

  it('rejects a file over the size limit', () => {
    expect(validateDocumentFile({ size: MAX_DOCUMENT_BYTES + 1, type: 'application/pdf' })).toMatch(
      /too large/,
    );
  });

  it('accepts a zip archive', () => {
    expect(validateDocumentFile({ size: 1024, type: 'application/zip' })).toBeNull();
  });

  it('accepts a zip archive with the Windows mime type', () => {
    expect(validateDocumentFile({ size: 1024, type: 'application/x-zip-compressed' })).toBeNull();
  });

  it('rejects a disallowed mime type', () => {
    expect(validateDocumentFile({ size: 1024, type: 'application/x-msdownload' })).toMatch(
      /Only PDF, image, and ZIP files/,
    );
  });
});
