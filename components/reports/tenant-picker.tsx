'use client';

import { useRouter } from 'next/navigation';
import { NativeSelect } from '@/components/ui/native-select';

export interface TenantOption {
  tenantId: string;
  label: string;
}

export function TenantPicker({
  tenants,
  value,
}: {
  tenants: TenantOption[];
  value: string | null;
}) {
  const router = useRouter();
  return (
    <NativeSelect
      aria-label='Tenant'
      value={value ?? ''}
      onChange={(e) => router.push(`/reports/tenant-ledger?tenant=${e.target.value}`)}
      className='w-auto'
    >
      <option value='' disabled>
        Select a tenant…
      </option>
      {tenants.map((t) => (
        <option key={t.tenantId} value={t.tenantId}>
          {t.label}
        </option>
      ))}
    </NativeSelect>
  );
}
