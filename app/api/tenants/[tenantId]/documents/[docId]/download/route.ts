import { Readable } from 'node:stream';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { ownerScope } from '@/lib/access';
import { findAuthorizedDocument } from '@/lib/tenants';
import { getDriveFileStream } from '@/lib/drive';
import { contentDispositionAttachment } from '@/lib/content-disposition';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string; docId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });

  const { tenantId, docId } = await params;
  const doc = await findAuthorizedDocument(docId, ownerScope(session));
  if (!doc || doc.tenant_id !== tenantId) return new Response('Not found', { status: 404 });

  const stream = await getDriveFileStream(doc.drive_file_id);
  if (!stream) return new Response('Document storage is not configured', { status: 503 });

  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: {
      'Content-Type': doc.mime_type,
      'Content-Disposition': contentDispositionAttachment(doc.file_name),
      'Content-Length': String(doc.size_bytes),
    },
  });
}
