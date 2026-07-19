import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// googleapis is mocked: google.drive() returns a fake Drive whose files.* are
// spies. vi.hoisted shares them with the (hoisted) vi.mock factory.
const { files, OAuth2, driveFactory } = vi.hoisted(() => {
  const files = {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  };
  return {
    files,
    OAuth2: vi.fn(function (this: { setCredentials: () => void }) {
      this.setCredentials = vi.fn();
    }),
    driveFactory: vi.fn(() => ({ files })),
  };
});
vi.mock('googleapis', () => ({ google: { auth: { OAuth2 }, drive: driveFactory } }));

const CONFIG = {
  GOOGLE_DRIVE_CLIENT_ID: 'id',
  GOOGLE_DRIVE_CLIENT_SECRET: 'secret',
  GOOGLE_DRIVE_REFRESH_TOKEN: 'refresh',
};

function fakeFile(name: string, type: string): File {
  return {
    name,
    type,
    stream: () => Readable.toWeb(Readable.from([Buffer.from('hello')])),
  } as unknown as File;
}

async function loadDrive(env: Record<string, string> = {}) {
  vi.resetModules();
  // getDrive / ensureFolder cache on globalThis; clear both between loads.
  const g = globalThis as { driveClient?: unknown; driveFolderId?: unknown };
  delete g.driveClient;
  delete g.driveFolderId;
  for (const key of Object.keys(CONFIG)) vi.stubEnv(key, env[key] ?? '');
  return import('@/lib/drive');
}

beforeEach(() => {
  Object.values(files).forEach((f) => f.mockReset());
  driveFactory.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('isDriveConfigured', () => {
  it('requires all three OAuth env vars', async () => {
    expect((await loadDrive({})).isDriveConfigured()).toBe(false);
    expect(
      (
        await loadDrive({ GOOGLE_DRIVE_CLIENT_ID: 'id', GOOGLE_DRIVE_CLIENT_SECRET: 's' })
      ).isDriveConfigured(),
    ).toBe(false);
    expect((await loadDrive(CONFIG)).isDriveConfigured()).toBe(true);
  });
});

describe('uploadFileToDrive', () => {
  it('returns null (and skips the API) when unconfigured', async () => {
    const { uploadFileToDrive } = await loadDrive({});
    expect(await uploadFileToDrive(fakeFile('a.pdf', 'application/pdf'), 't1')).toBeNull();
    expect(files.create).not.toHaveBeenCalled();
  });

  it('reuses an existing documents folder and uploads into it', async () => {
    files.list.mockResolvedValue({ data: { files: [{ id: 'folder-1' }] } });
    files.create.mockResolvedValue({ data: { id: 'file-1' } });

    const { uploadFileToDrive } = await loadDrive(CONFIG);
    const id = await uploadFileToDrive(fakeFile('lease.pdf', 'application/pdf'), 't1');

    expect(id).toBe('file-1');
    // Only the file create — no folder create, since the folder already exists.
    expect(files.create).toHaveBeenCalledTimes(1);
    const req = files.create.mock.calls[0][0];
    expect(req.requestBody.parents).toEqual(['folder-1']);
    expect(req.requestBody.appProperties).toEqual({ tenantId: 't1' });
  });

  it('creates the documents folder when none exists', async () => {
    files.list.mockResolvedValue({ data: { files: [] } });
    files.create
      .mockResolvedValueOnce({ data: { id: 'new-folder' } }) // folder
      .mockResolvedValueOnce({ data: { id: 'file-2' } }); // file

    const { uploadFileToDrive } = await loadDrive(CONFIG);
    const id = await uploadFileToDrive(fakeFile('a.pdf', 'application/pdf'), 't2');

    expect(id).toBe('file-2');
    expect(files.create).toHaveBeenCalledTimes(2);
    expect(files.create.mock.calls[0][0].requestBody.mimeType).toBe(
      'application/vnd.google-apps.folder',
    );
  });

  it('throws when the folder cannot be found or created', async () => {
    files.list.mockResolvedValue({ data: { files: [] } });
    files.create.mockResolvedValueOnce({ data: {} }); // folder create returns no id

    const { uploadFileToDrive } = await loadDrive(CONFIG);
    await expect(uploadFileToDrive(fakeFile('a.pdf', 'application/pdf'), 't1')).rejects.toThrow(
      /find or create/,
    );
  });

  it('reuses one Drive client and one folder lookup across uploads', async () => {
    files.list.mockResolvedValue({ data: { files: [{ id: 'folder-1' }] } });
    files.create.mockResolvedValue({ data: { id: 'file-1' } });

    const { uploadFileToDrive } = await loadDrive(CONFIG);
    await uploadFileToDrive(fakeFile('a.pdf', 'application/pdf'), 't1');
    await uploadFileToDrive(fakeFile('b.pdf', 'application/pdf'), 't1');

    expect(driveFactory).toHaveBeenCalledTimes(1); // client cached on globalThis
    expect(files.list).toHaveBeenCalledTimes(1); // folder id cached
  });

  it('throws when the upload returns no file id', async () => {
    files.list.mockResolvedValue({ data: { files: [{ id: 'folder-1' }] } });
    files.create.mockResolvedValue({ data: {} });

    const { uploadFileToDrive } = await loadDrive(CONFIG);
    await expect(uploadFileToDrive(fakeFile('a.pdf', 'application/pdf'), 't1')).rejects.toThrow(
      /no file id/,
    );
  });
});

describe('getDriveFileStream', () => {
  it('returns null when unconfigured', async () => {
    const { getDriveFileStream } = await loadDrive({});
    expect(await getDriveFileStream('f1')).toBeNull();
  });

  it('returns the media stream from Drive', async () => {
    const stream = Readable.from([Buffer.from('data')]);
    files.get.mockResolvedValue({ data: stream });
    const { getDriveFileStream } = await loadDrive(CONFIG);

    expect(await getDriveFileStream('f1')).toBe(stream);
    expect(files.get.mock.calls[0][0]).toMatchObject({ fileId: 'f1', alt: 'media' });
  });
});

describe('deleteDriveFile', () => {
  it('is a no-op when unconfigured', async () => {
    const { deleteDriveFile } = await loadDrive({});
    await expect(deleteDriveFile('f1')).resolves.toBeUndefined();
    expect(files.delete).not.toHaveBeenCalled();
  });

  it('deletes the file', async () => {
    files.delete.mockResolvedValue({});
    const { deleteDriveFile } = await loadDrive(CONFIG);
    await deleteDriveFile('f1');
    expect(files.delete).toHaveBeenCalledWith({ fileId: 'f1' });
  });

  it('swallows a 404 so delete stays idempotent', async () => {
    files.delete.mockRejectedValue({ status: 404 });
    const { deleteDriveFile } = await loadDrive(CONFIG);
    await expect(deleteDriveFile('gone')).resolves.toBeUndefined();
  });

  it('swallows a 404 reported under response.status', async () => {
    files.delete.mockRejectedValue({ response: { status: 404 } });
    const { deleteDriveFile } = await loadDrive(CONFIG);
    await expect(deleteDriveFile('gone')).resolves.toBeUndefined();
  });

  it('rethrows non-404 errors', async () => {
    files.delete.mockRejectedValue({ status: 500 });
    const { deleteDriveFile } = await loadDrive(CONFIG);
    await expect(deleteDriveFile('f1')).rejects.toEqual({ status: 500 });
  });
});
