import { describe, it, expect } from 'vitest';
import {
  createUserSchema,
  promoteToAdminSchema,
  createPropertySchema,
  createUnitSchema,
  assignTenantSchema,
  updateTenantSchema,
  recordPaymentSchema,
  validateDocumentFile,
  MAX_DOCUMENT_BYTES,
  createMaintenanceContactSchema,
  updateMaintenanceContactSchema,
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

describe('maintenance contact schemas', () => {
  const validContact = {
    name: 'Mario Santos',
    company: 'Santos Repairs',
    phone: '09171234567',
    email: '',
    serviceArea: 'Cagayan',
    availability: 'Mon–Sat',
    notes: '',
    services: ['plumber', 'handyman_repair'],
    isPreferred: false,
    ownerId: '',
  };

  it('accepts multiple services and a phone number', () => {
    const result = createMaintenanceContactSchema.safeParse(validContact);
    expect(result.success).toBe(true);
  });

  it('accepts email as the only contact method', () => {
    const result = createMaintenanceContactSchema.safeParse({
      ...validContact,
      phone: '',
      email: 'mario@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('requires at least one service', () => {
    const result = createMaintenanceContactSchema.safeParse({ ...validContact, services: [] });
    expect(result.success).toBe(false);
  });

  it('requires a phone number or email address', () => {
    const result = createMaintenanceContactSchema.safeParse({
      ...validContact,
      phone: '',
      email: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed email addresses', () => {
    const result = createMaintenanceContactSchema.safeParse({
      ...validContact,
      phone: '',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('requires an id when updating', () => {
    const result = updateMaintenanceContactSchema.safeParse(validContact);
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
      depositAmount: '150000',
      leaseStartDate: '2026-01-01',
      leaseEndDate: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.depositAmount).toBe(150000);
    }
  });

  it('rejects a malformed lease start date', () => {
    const result = assignTenantSchema.safeParse({
      unitId: 'unit-1',
      name: 'Jane Tenant',
      rentAmount: '150000',
      depositAmount: '150000',
      leaseStartDate: '01/01/2026',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a lease end date before the lease start date', () => {
    const result = assignTenantSchema.safeParse({
      unitId: 'unit-1',
      name: 'Jane Tenant',
      rentAmount: '150000',
      depositAmount: '150000',
      leaseStartDate: '2026-07-15',
      leaseEndDate: '2026-07-10',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.leaseEndDate).toBeTruthy();
    }
  });

  it('rejects a missing deposit amount', () => {
    const result = assignTenantSchema.safeParse({
      unitId: 'unit-1',
      name: 'Jane Tenant',
      rentAmount: '150000',
      leaseStartDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.depositAmount).toBeTruthy();
    }
  });

  it('rejects a negative deposit amount', () => {
    const result = assignTenantSchema.safeParse({
      unitId: 'unit-1',
      name: 'Jane Tenant',
      rentAmount: '150000',
      depositAmount: '-100',
      leaseStartDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateTenantSchema', () => {
  it('accepts an updated tenant with a deposit differing from rent', () => {
    const result = updateTenantSchema.safeParse({
      id: 'tenant-1',
      name: 'Jane Tenant',
      rentAmount: '180000',
      depositAmount: '150000',
      leaseStartDate: '2026-01-01',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.depositAmount).toBe(150000);
    }
  });

  it('rejects a fractional-cents deposit amount', () => {
    const result = updateTenantSchema.safeParse({
      id: 'tenant-1',
      name: 'Jane Tenant',
      rentAmount: '150000',
      depositAmount: '1500.5',
      leaseStartDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
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

describe('Philippine phone validation', () => {
  const base = {
    unitId: 'u1',
    name: 'Ana',
    rentAmount: 100000,
    depositAmount: 100000,
    leaseStartDate: '2026-07-01',
  };

  it.each(['09171234567', '+639171234567', '0917-123-4567', '(0917) 123 4567'])(
    'accepts valid PH number %s',
    (phone) => {
      expect(assignTenantSchema.safeParse({ ...base, phone }).success).toBe(true);
    },
  );

  it.each(['12345', '9171234567', '+6391712345', '08171234567'])(
    'rejects invalid PH number %s',
    (phone) => {
      const result = assignTenantSchema.safeParse({ ...base, phone });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.phone?.[0]).toMatch(/valid Philippine phone/);
      }
    },
  );

  it('treats an empty phone as valid (optional)', () => {
    expect(assignTenantSchema.safeParse({ ...base, phone: '' }).success).toBe(true);
  });

  it('rejects a lease end before the lease start', () => {
    const result = assignTenantSchema.safeParse({
      ...base,
      leaseStartDate: '2026-07-01',
      leaseEndDate: '2026-06-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.leaseEndDate?.[0]).toMatch(/on or after/);
    }
  });
});
