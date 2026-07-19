import { z } from 'zod';
import { MAINTENANCE_SERVICE_VALUES } from '@/lib/maintenance-contacts';

const isValidPhilippinePhone = (value: string) => {
  if (!value) return true;
  // Remove spaces, dashes, and parentheses for validation
  const cleaned = value.replace(/[\s\-().]/g, '');
  // Accept: 09XXXXXXXXX (11 digits total) or +639XXXXXXXXX (12 chars)
  return /^(09\d{9}|\+639\d{9})$/.test(cleaned);
};

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

const optionalPhPhone = z
  .union([
    z
      .string()
      .max(50, 'Phone is too long')
      .refine(isValidPhilippinePhone, 'Must be a valid Philippine phone number'),
    z.literal(''),
  ])
  .optional();

const occupantsField = z
  .array(
    z.string().trim().min(1, 'Occupant name cannot be empty').max(100, 'Occupant name is too long'),
  )
  .max(10, 'At most 10 occupants')
  .optional();

const leaseRangeCheck = {
  check: (data: { leaseStartDate: string; leaseEndDate?: string }) =>
    !data.leaseEndDate || data.leaseEndDate >= data.leaseStartDate,
  options: {
    message: 'Lease end must be on or after lease start',
    path: ['leaseEndDate'],
  },
};

export const assignTenantSchema = z
  .object({
    unitId: z.string().min(1, 'Unit id is required'),
    name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
    email: z.union([z.string().email('Invalid email address'), z.literal('')]).optional(),
    phone: optionalPhPhone,
    occupants: occupantsField,
    emergencyContactName: z.string().max(200, 'Name is too long').optional().or(z.literal('')),
    emergencyContactPhone: optionalPhPhone,
    rentAmount: centsField,
    depositAmount: centsField,
    leaseStartDate: dateField,
    leaseEndDate: optionalDateField,
  })
  .refine(leaseRangeCheck.check, leaseRangeCheck.options);

export const updateTenantSchema = z
  .object({
    id: z.string().min(1, 'Tenant id is required'),
    name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
    email: z.union([z.string().email('Invalid email address'), z.literal('')]).optional(),
    phone: optionalPhPhone,
    occupants: occupantsField,
    emergencyContactName: z.string().max(200, 'Name is too long').optional().or(z.literal('')),
    emergencyContactPhone: optionalPhPhone,
    rentAmount: centsField,
    depositAmount: centsField,
    leaseStartDate: dateField,
    leaseEndDate: optionalDateField,
  })
  .refine(leaseRangeCheck.check, leaseRangeCheck.options);

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

const maintenanceContactBaseSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long'),
    company: z.string().trim().max(200, 'Company is too long').optional().or(z.literal('')),
    phone: z.string().trim().max(50, 'Phone number is too long').optional().or(z.literal('')),
    email: z
      .string()
      .trim()
      .max(320, 'Email is too long')
      .email('Invalid email address')
      .optional()
      .or(z.literal('')),
    serviceArea: z
      .string()
      .trim()
      .max(300, 'Service area is too long')
      .optional()
      .or(z.literal('')),
    availability: z
      .string()
      .trim()
      .max(300, 'Availability is too long')
      .optional()
      .or(z.literal('')),
    notes: z.string().trim().max(2000, 'Notes are too long').optional().or(z.literal('')),
    services: z
      .array(z.enum(MAINTENANCE_SERVICE_VALUES))
      .min(1, 'Select at least one service')
      .max(MAINTENANCE_SERVICE_VALUES.length),
    isPreferred: z.coerce.boolean().default(false),
    ownerId: z.string().trim().optional().or(z.literal('')),
  })
  .refine((data) => Boolean(data.phone || data.email), {
    message: 'Add a phone number or email address',
    path: ['phone'],
  });

export const createMaintenanceContactSchema = maintenanceContactBaseSchema;

export const updateMaintenanceContactSchema = maintenanceContactBaseSchema.safeExtend({
  id: z.string().min(1, 'Contact id is required'),
});

export const maintenanceContactStateSchema = z.object({
  id: z.string().min(1, 'Contact id is required'),
  value: z.enum(['true', 'false']).optional(),
});

// Tenant document uploads (stored in Google Drive). Keep in sync with the
// serverActions.bodySizeLimit in next.config.ts.
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/zip',
  'application/x-zip-compressed', // Windows browsers report zips with this type
];

// Returns an error message, or null when the file is acceptable.
export function validateDocumentFile(file: { size: number; type: string }): string | null {
  if (file.size === 0) return 'The selected file is empty.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'File is too large (max 10MB).';
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    return 'Only PDF, image, and ZIP files (JPG, PNG, WebP, HEIC, ZIP) are allowed.';
  }
  return null;
}
