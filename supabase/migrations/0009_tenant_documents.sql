-- Tenant documents stored in Google Drive; this table is the source of truth
-- mapping tenants to their Drive files.
create table tenant_documents (
  id text primary key,
  tenant_id text not null references tenants(id) on delete cascade,
  drive_file_id text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create index tenant_documents_tenant_id_idx on tenant_documents(tenant_id);
