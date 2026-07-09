import { queryOne } from '@/lib/db';

// Ownership-scoped lookups shared by server actions and route handlers.
// `scope` follows the ownerScope convention: null ⇒ admin ⇒ no filter.

export async function findAuthorizedTenant(tenantId: string, scope: string | null) {
  return queryOne<{
    id: string;
    unit_id: string;
    property_id: string;
    is_active: boolean;
    name: string;
    email: string | null;
    unit_label: string;
    property_name: string;
    lease_start_date: string;
  }>(
    `SELECT t.id, t.unit_id, u.property_id, t.is_active, t.name, t.email,
            u.unit_label, p.name AS property_name, t.lease_start_date FROM tenants t
     JOIN units u ON u.id = t.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE t.id = $1 AND ($2::text IS NULL OR p.user_id = $2)`,
    [tenantId, scope],
  );
}

export async function findAuthorizedDocument(documentId: string, scope: string | null) {
  return queryOne<{
    id: string;
    tenant_id: string;
    unit_id: string;
    property_id: string;
    drive_file_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: string;
  }>(
    `SELECT d.id, d.tenant_id, t.unit_id, u.property_id,
            d.drive_file_id, d.file_name, d.mime_type, d.size_bytes
     FROM tenant_documents d
     JOIN tenants t ON t.id = d.tenant_id
     JOIN units u ON u.id = t.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE d.id = $1 AND ($2::text IS NULL OR p.user_id = $2)`,
    [documentId, scope],
  );
}
