import { Readable } from 'node:stream';
import { google, type drive_v3 } from 'googleapis';

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

const DOCUMENTS_FOLDER_NAME = '8TURF Documents';

// Survive Next.js dev-server module reloads with a single client
const globalForDrive = globalThis as unknown as {
  driveClient?: drive_v3.Drive;
  driveFolderId?: string;
};

export function isDriveConfigured(): boolean {
  return Boolean(clientId && clientSecret && refreshToken);
}

function getDrive(): drive_v3.Drive | null {
  if (!isDriveConfigured()) return null;
  if (!globalForDrive.driveClient) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    globalForDrive.driveClient = google.drive({ version: 'v3', auth: oauth2 });
  }
  return globalForDrive.driveClient;
}

async function ensureFolder(drive: drive_v3.Drive): Promise<string> {
  if (globalForDrive.driveFolderId) return globalForDrive.driveFolderId;

  const existing = await drive.files.list({
    q: `name = '${DOCUMENTS_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
  });
  let folderId = existing.data.files?.[0]?.id ?? null;

  if (!folderId) {
    const created = await drive.files.create({
      requestBody: {
        name: DOCUMENTS_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    folderId = created.data.id ?? null;
  }

  if (!folderId) throw new Error('Failed to find or create the Google Drive documents folder');
  globalForDrive.driveFolderId = folderId;
  return folderId;
}

export async function uploadFileToDrive(file: File, tenantId: string): Promise<string | null> {
  const drive = getDrive();
  if (!drive) {
    console.warn('GOOGLE_DRIVE_* env vars not set — skipping document upload');
    return null;
  }

  const folderId = await ensureFolder(drive);
  const res = await drive.files.create({
    requestBody: {
      name: file.name,
      parents: [folderId],
      appProperties: { tenantId },
    },
    media: {
      mimeType: file.type,
      body: Readable.fromWeb(file.stream() as unknown as import('node:stream/web').ReadableStream),
    },
    fields: 'id',
  });

  const fileId = res.data.id;
  if (!fileId) throw new Error('Google Drive upload returned no file id');
  return fileId;
}

export async function getDriveFileStream(driveFileId: string): Promise<Readable | null> {
  const drive = getDrive();
  if (!drive) return null;
  const res = await drive.files.get(
    { fileId: driveFileId, alt: 'media' },
    { responseType: 'stream' },
  );
  return res.data as Readable;
}

// Tolerates already-deleted files so delete stays idempotent.
export async function deleteDriveFile(driveFileId: string): Promise<void> {
  const drive = getDrive();
  if (!drive) return;
  try {
    await drive.files.delete({ fileId: driveFileId });
  } catch (err) {
    const status =
      (err as { status?: number; response?: { status?: number } }).status ??
      (err as { response?: { status?: number } }).response?.status;
    if (status === 404) return;
    throw err;
  }
}
