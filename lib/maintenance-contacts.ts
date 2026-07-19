export const MAINTENANCE_SERVICES = [
  { value: 'plumber', label: 'Plumber' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'carpenter', label: 'Carpenter' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'handyman_repair', label: 'Handyman / Repair' },
  { value: 'aircon_hvac', label: 'Aircon / HVAC' },
  { value: 'appliance_repair', label: 'Appliance Repair' },
  { value: 'locksmith', label: 'Locksmith' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'other', label: 'Other' },
] as const;

export type MaintenanceService = (typeof MAINTENANCE_SERVICES)[number]['value'];

export const MAINTENANCE_SERVICE_VALUES = MAINTENANCE_SERVICES.map((service) => service.value) as [
  MaintenanceService,
  ...MaintenanceService[],
];

export const MAINTENANCE_SERVICE_LABELS = Object.fromEntries(
  MAINTENANCE_SERVICES.map((service) => [service.value, service.label]),
) as Record<MaintenanceService, string>;

export interface MaintenanceContact {
  id: string;
  user_id: string;
  owner_name: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  service_area: string | null;
  availability: string | null;
  notes: string | null;
  services: MaintenanceService[];
  is_preferred: boolean;
  archived_at: string | null;
  updated_at: string;
}
