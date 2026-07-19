import { describe, it, expect } from 'vitest';
import { contentDispositionAttachment } from '@/lib/content-disposition';

describe('contentDispositionAttachment', () => {
  it('keeps plain ASCII filenames as-is', () => {
    expect(contentDispositionAttachment('lease.pdf')).toBe(
      `attachment; filename="lease.pdf"; filename*=UTF-8''lease.pdf`,
    );
  });

  it('produces a header-safe value for filenames with non-ASCII characters', () => {
    // macOS screenshots put a narrow no-break space (U+202F) before AM/PM
    const header = contentDispositionAttachment('Screenshot 2026-07-09 at 1.48.18 PM.png');
    for (const ch of header) {
      expect(ch.codePointAt(0)!).toBeLessThan(127);
    }
    expect(header).toContain(
      `filename*=UTF-8''Screenshot%202026-07-09%20at%201.48.18%E2%80%AFPM.png`,
    );
    expect(header).toContain('filename="Screenshot 2026-07-09 at 1.48.18PM.png"');
  });

  it('strips quotes and backslashes from the fallback filename', () => {
    const header = contentDispositionAttachment('we"ird\\name.pdf');
    expect(header).toContain('filename="weirdname.pdf"');
  });

  it('percent-encodes RFC-5987-reserved characters in the UTF-8 field', () => {
    // ' ( ) * are left alone by encodeURIComponent but are not valid in the
    // ext-value token, so they must be manually percent-encoded.
    const header = contentDispositionAttachment("re'ce(i)pt*.pdf");
    expect(header).toContain("filename*=UTF-8''re%27ce%28i%29pt%2A.pdf");
    // Fallback keeps them since they are printable ASCII.
    expect(header).toContain(`filename="re'ce(i)pt*.pdf"`);
  });

  it('is constructible as a real HTTP header', () => {
    const name = 'Screenshot 2026-07-09 at 1.48.18 PM.png';
    expect(
      () => new Headers({ 'Content-Disposition': contentDispositionAttachment(name) }),
    ).not.toThrow();
  });
});
