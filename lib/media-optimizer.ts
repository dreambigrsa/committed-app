import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { getNetworkProfile, isSlowNetwork, loadDataSaverSettings } from './data-saver';

const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function getAdaptiveImageQuality(): Promise<number> {
  const [settings, network] = await Promise.all([
    loadDataSaverSettings(),
    getNetworkProfile(),
  ]);
  const effectiveDataSaver = settings.enabled || (settings.autoOnCellular && network.isCellular);
  if (effectiveDataSaver || isSlowNetwork(network)) return 0.5;
  if (network.isCellular) return 0.65;
  return 0.8;
}

export async function optimizeImageForUpload(uri: string): Promise<string> {
  try {
    const quality = await getAdaptiveImageQuality();
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri || uri;
  } catch {
    return uri;
  }
}

export async function assertMediaWithinLimit(uri: string, kind: 'image' | 'video'): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  const size = typeof (info as any).size === 'number' ? (info as any).size : 0;
  const limit = kind === 'video' ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
  if (size > limit) {
    const limitMb = Math.round(limit / (1024 * 1024));
    throw new Error(`${kind === 'image' ? 'Image' : 'Video'} is too large. Please choose a file under ${limitMb}MB.`);
  }
}
