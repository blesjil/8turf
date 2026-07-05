import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
});

export const promoteToAdminSchema = z.object({
  userId: z.string().min(1, 'User id is required'),
});

export const createPropertySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  address: z.string().min(1, 'Address is required').max(500, 'Address is too long'),
});

export const updatePropertySchema = createPropertySchema.extend({
  id: z.string().min(1, 'Property id is required'),
});

const centsField = z.coerce
  .number()
  .int('Must be a whole number of cents')
  .min(0, 'Must be zero or greater');

export const createUnitSchema = z.object({
  propertyId: z.string().min(1, 'Property id is required'),
  unitLabel: z.string().min(1, 'Unit label is required').max(100, 'Unit label is too long'),
  bedrooms: z.coerce.number().int().min(0, 'Bedrooms must be zero or greater'),
  bathrooms: z.coerce.number().min(0, 'Bathrooms must be zero or greater'),
  rentAmount: centsField,
});

export const updateUnitSchema = createUnitSchema.omit({ propertyId: true }).extend({
  id: z.string().min(1, 'Unit id is required'),
});

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)');
const optionalDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-DD)')
  .optional()
  .or(z.literal(''));

export const assignTenantSchema = z.object({
  unitId: z.string().min(1, 'Unit id is required'),
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(50, 'Phone is too long').optional().or(z.literal('')),
  rentAmount: centsField,
  leaseStartDate: dateField,
  leaseEndDate: optionalDateField,
});

export const updateTenantSchema = z.object({
  id: z.string().min(1, 'Tenant id is required'),
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(50, 'Phone is too long').optional().or(z.literal('')),
  rentAmount: centsField,
  leaseStartDate: dateField,
  leaseEndDate: optionalDateField,
});

export const endTenancySchema = z.object({
  id: z.string().min(1, 'Tenant id is required'),
  leaseEndDate: dateField,
});

const periodField = z.string().regex(/^\d{4}-\d{2}$/, 'Must be a valid month (YYYY-MM)');

export const recordPaymentSchema = z.object({
  tenantId: z.string().min(1, 'Tenant id is required'),
  amount: z.coerce
    .number()
    .int('Must be a whole number of cents')
    .positive('Must be greater than zero'),
  period: periodField,
  paidDate: dateField,
  method: z.enum(['cash', 'bank_transfer', 'check', 'other']).optional().or(z.literal('')),
  notes: z.string().max(1000, 'Notes are too long').optional().or(z.literal('')),
});

export const updatePaymentSchema = recordPaymentSchema.omit({ tenantId: true }).extend({
  id: z.string().min(1, 'Payment id is required'),
});
