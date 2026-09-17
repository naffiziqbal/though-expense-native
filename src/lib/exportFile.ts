import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * Writes the export to a temp file and opens the system share sheet so the
 * user can save to Downloads, Drive, email, etc. — no folder permission grant.
 */
export type SaveExportResult = { status: 'shared' } | { status: 'unavailable' };

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
