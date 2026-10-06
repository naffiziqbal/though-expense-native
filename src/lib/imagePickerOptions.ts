import type { ImagePickerOptions } from 'expo-image-picker';

/** Lower decode size / memory for camera & gallery (Play bitmap downsampling hint). */
export const IMPORT_IMAGE_PICKER_OPTIONS: ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.75,
  exif: false,
};

export const AVATAR_IMAGE_PICKER_OPTIONS: ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.7,
  exif: false,
};
