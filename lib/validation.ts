import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
});

export const promoteToAdminSchema = z.object({
  userId: z.string().min(1, 'User id is required'),
});

export const resetUserPasswordSchema = z.object({
  userId: z.string().min(1, 'User id is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password is too long')
    .optional()
    .or(z.literal('')),
});

export const createPropertySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  address: z.string().min(1, 'Address is required').max(500, 'Address is too long'),
  ownerId: z.string().optional(),
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

const paymentTypeField = z.enum(['deposit', 'advance', 'reservation', 'rental']);

const paymentBaseSchema = z.object({
  amount: z.coerce
    .number()
    .int('Must be a whole number of cents')
    .positive('Must be greater than zero'),
  periodStart: dateField,
  periodEnd: dateField,
  paidDate: dateField,
  paymentType: paymentTypeField,
  method: z.enum(['cash', 'bank_transfer', 'gcash', 'other']).optional().or(z.literal('')),
  notes: z.string().max(1000, 'Notes are too long').optional().or(z.literal('')),
});

const periodRangeCheck = {
  check: (data: { periodStart: string; periodEnd: string }) => data.periodEnd >= data.periodStart,
  options: {
    message: 'Period end must be on or after period start',
    path: ['periodEnd'],
  },
};

export const recordPaymentSchema = paymentBaseSchema
  .extend({
    tenantId: z.string().min(1, 'Tenant id is required'),
  })
  .refine(periodRangeCheck.check, periodRangeCheck.options);

export const updatePaymentSchema = paymentBaseSchema
  .extend({
    id: z.string().min(1, 'Payment id is required'),
  })
  .refine(periodRangeCheck.check, periodRangeCheck.options);

const expenseCategoryField = z.enum(['repair', 'cleaning', 'tax', 'other']);
const expenseBaseSchema = z.object({
  category: expenseCategoryField,
  amount: z.coerce
    .number()
    .int('Must be a whole number of cents')
    .positive('Must be greater than zero'),
  expenseDate: dateField,
  remarks: z.string().max(1000, 'Remarks are too long').optional().or(z.literal('')),
});

export const recordPropertyExpenseSchema = expenseBaseSchema.extend({
  propertyId: z.string().min(1, 'Property id is required'),
});
export const updatePropertyExpenseSchema = expenseBaseSchema.extend({
  id: z.string().min(1, 'Expense id is required'),
});

export const recordUnitExpenseSchema = expenseBaseSchema.extend({
  unitId: z.string().min(1, 'Unit id is required'),
});
export const updateUnitExpenseSchema = expenseBaseSchema.extend({
  id: z.string().min(1, 'Expense id is required'),
});
