// HTTP header values must be ASCII, but file names often aren't (e.g. macOS
// screenshots contain U+202F before "PM"). RFC 6266/5987: send an ASCII-only
// `filename` fallback plus a percent-encoded UTF-8 `filename*`.
export function contentDispositionAttachment(fileName: string): string {
  const asciiFallback = fileName.replace(/["\\]/g, '').replace(/[^\x20-\x7e]/g, '');
  const utf8Encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`;
}
