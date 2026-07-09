'use client';

import { useActionState, useState } from 'react';
import { FileIcon, XIcon } from 'lucide-react';
import { formatDate } from '@/lib/format-date';
import { validateDocumentFile } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  uploadTenantDocument,
  deleteTenantDocument,
  type DocumentActionResult,
} from '@/app/properties/[id]/units/[unitId]/actions';

export interface TenantDocument {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: string;
  created_at: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TenantDocuments({
  tenantId,
  documents,
  enabled,
}: {
  tenantId: string;
  documents: TenantDocument[];
  enabled: boolean;
}) {
  const [uploadState, uploadAction, uploadPending] = useActionState<DocumentActionResult, FormData>(
    uploadTenantDocument,
    {},
  );
  const [clientError, setClientError] = useState<string | null>(null);

  const handleUpload = async (formData: FormData) => {
    const file = formData.get('file');
    if (!(file instanceof File) || !file.name) {
      setClientError('Please choose a file to upload.');
      return;
    }
    const fileError = validateDocumentFile(file);
    if (fileError) {
      setClientError(fileError);
      return;
    }
    setClientError(null);
    await uploadAction(formData);
  };

  const error = clientError ?? uploadState.error;

  return (
    <div className='border-t border-border pt-4'>
      <h4 className='mb-2 text-sm font-semibold'>
        Documents{' '}
        <span className='font-normal text-muted-foreground'>(lease contract, valid ID, …)</span>
      </h4>

      {documents.length > 0 && (
        <ul className='mb-3 space-y-1'>
          {documents.map((doc) => (
            <li key={doc.id} className='flex items-center gap-2 text-sm'>
              <FileIcon className='size-4 shrink-0 text-muted-foreground' />
              <a
                href={`/api/tenants/${tenantId}/documents/${doc.id}/download`}
                className='truncate font-medium text-primary hover:underline'
              >
                {doc.file_name}
              </a>
              <span className='shrink-0 text-muted-foreground'>
                {formatBytes(Number(doc.size_bytes))} · {formatDate(doc.created_at)}
              </span>
              <form action={deleteTenantDocument} className='ml-auto shrink-0'>
                <input type='hidden' name='id' value={doc.id} />
                <Button type='submit' variant='ghost' size='icon-sm'>
                  <XIcon />
                  <span className='sr-only'>Delete {doc.file_name}</span>
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {documents.length === 0 && !enabled && (
        <p className='text-sm text-muted-foreground'>Document storage is not configured.</p>
      )}

      {enabled && (
        <form action={handleUpload} className='flex flex-wrap items-center gap-2'>
          <input type='hidden' name='tenantId' value={tenantId} />
          <Label htmlFor={`tenant-document-${tenantId}`} className='sr-only'>
            Upload document
          </Label>
          <Input
            id={`tenant-document-${tenantId}`}
            type='file'
            name='file'
            accept='application/pdf,image/jpeg,image/png,image/webp,image/heic,application/zip,application/x-zip-compressed,.zip'
            required
            className='max-w-xs'
          />
          <Button type='submit' variant='outline' size='sm' disabled={uploadPending}>
            {uploadPending ? 'Uploading…' : 'Upload'}
          </Button>
          {error && <p className='w-full text-sm text-destructive'>{error}</p>}
        </form>
      )}
    </div>
  );
}
