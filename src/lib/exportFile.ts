import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * Writes the export to a temp file and opens the system share sheet so the
 * user can save to Downloads, Drive, email, etc. — no folder permission grant.
 */
export type SaveExportResult = { status: 'shared' } | { status: 'unavailable' };

export function base64FromArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b3 & 63] : '=';
  }
  return result;
}

interface SaveExportOptions {
  /** File contents, base64 encoded. */
  base64: string;
  baseName: string;
  extension: string;
  mimeType: string;
}

export async function saveExportedFile({
  base64,
  baseName,
  extension,
  mimeType,
}: SaveExportOptions): Promise<SaveExportResult> {
  const fileUri = `${FileSystem.cacheDirectory}${baseName}.${extension}`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!(await Sharing.isAvailableAsync())) {
    return { status: 'unavailable' };
  }

  await Sharing.shareAsync(fileUri, {
    mimeType,
    dialogTitle: `Export expenses (${extension.toUpperCase()})`,
    UTI: extension === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
  });

  return { status: 'shared' };
}
