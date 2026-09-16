import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Saves an exported report straight to a user-visible location instead of
 * handing it to the share sheet.
 *
 * Android grants folder access through the Storage Access Framework. That
 * picker appears once; the grant is remembered so later exports write through
 * with no dialog at all.
 *
 * iOS has no shared Downloads folder, so files go to the app's Documents
 * directory. `UIFileSharingEnabled` in app.json surfaces that under
 * Files › On My iPhone › ThoughtExpense, which is as close as the platform
 * gets to a direct download.
 */

const SAF_DIRECTORY_KEY = 'export-directory-uri';

export type SaveExportResult =
  | { status: 'saved'; uri: string; location: string }
  | { status: 'cancelled' };

interface SaveExportOptions {
  /** File contents, base64 encoded. */
  base64: string;
  /** Filename without the extension — Android derives it from `mimeType`. */
  baseName: string;
  extension: string;
  mimeType: string;
}

/** Turns `content://…/tree/primary%3ADownload` into `Download`. */
function folderLabel(directoryUri: string): string {
  try {
    const name = decodeURIComponent(directoryUri).split(':').pop()?.split('/').pop();
    return name ? name : 'your chosen folder';
  } catch {
    return 'your chosen folder';
  }
}

async function rememberedDirectory(): Promise<string | null> {
  const saved = await AsyncStorage.getItem(SAF_DIRECTORY_KEY);
  if (!saved) return null;

  // A remembered grant can go stale — app data cleared, folder deleted, SD card
  // removed — so confirm it still resolves rather than failing the export.
  try {
    await FileSystem.StorageAccessFramework.readDirectoryAsync(saved);
    return saved;
  } catch {
    await AsyncStorage.removeItem(SAF_DIRECTORY_KEY);
    return null;
  }
}

/** Forgets the saved Android folder so the next export asks again. */
export async function resetExportDirectory(): Promise<void> {
  await AsyncStorage.removeItem(SAF_DIRECTORY_KEY);
}

/** Whether a folder is already remembered, so the UI can offer to change it. */
export async function hasExportDirectory(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return (await rememberedDirectory()) !== null;
}

export async function saveExportedFile({
  base64,
  baseName,
  extension,
  mimeType,
}: SaveExportOptions): Promise<SaveExportResult> {
  if (Platform.OS === 'android') {
    let directoryUri = await rememberedDirectory();

    if (!directoryUri) {
      const { StorageAccessFramework } = FileSystem;
      const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync(
        StorageAccessFramework.getUriForDirectoryInRoot('Download')
      );
      if (!permission.granted) return { status: 'cancelled' };

      directoryUri = permission.directoryUri;
      await AsyncStorage.setItem(SAF_DIRECTORY_KEY, directoryUri);
    }

    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      directoryUri,
      baseName,
      mimeType
    );
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { status: 'saved', uri: fileUri, location: folderLabel(directoryUri) };
  }

  const fileUri = `${FileSystem.documentDirectory}${baseName}.${extension}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { status: 'saved', uri: fileUri, location: 'Files › On My iPhone › ThoughtExpense' };
}
