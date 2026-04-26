import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

const DATA_SAVER_STORAGE_KEY = 'committed:data-saver:settings';

export type DataSaverSettings = {
  enabled: boolean;
  autoOnCellular: boolean;
};

export type NetworkProfile = {
  isConnected: boolean;
  isWifi: boolean;
  isCellular: boolean;
  generation: string;
};

const DEFAULT_SETTINGS: DataSaverSettings = {
  enabled: false,
  autoOnCellular: true,
};

export async function loadDataSaverSettings(): Promise<DataSaverSettings> {
  try {
    const raw = await AsyncStorage.getItem(DATA_SAVER_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed?.enabled,
      autoOnCellular: parsed?.autoOnCellular !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveDataSaverSettings(settings: DataSaverSettings): Promise<void> {
  await AsyncStorage.setItem(DATA_SAVER_STORAGE_KEY, JSON.stringify(settings));
}

export async function getNetworkProfile(): Promise<NetworkProfile> {
  try {
    if (typeof navigator !== 'undefined') {
      const navAny = navigator as any;
      const online = typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
      const connection = navAny.connection || navAny.mozConnection || navAny.webkitConnection;
      const effectiveType = String(connection?.effectiveType || '').toLowerCase();
      const downlink = Number(connection?.downlink || 0);
      const generation =
        effectiveType === 'slow-2g' || effectiveType === '2g'
          ? '2g'
          : effectiveType === '3g'
          ? '3g'
          : effectiveType === '4g' || downlink >= 10
          ? '4g'
          : 'unknown';

      return {
        isConnected: online,
        isWifi: false,
        isCellular: generation === '2g' || generation === '3g' || generation === '4g',
        generation,
      };
    }

    const state = await Network.getNetworkStateAsync();
    const stateWithGeneration = state as typeof state & { cellularGeneration?: string | null };
    const type = String(state.type || '').toLowerCase();
    const generation = String(stateWithGeneration.cellularGeneration || 'unknown').toLowerCase();
    return {
      isConnected: !!state.isConnected,
      isWifi: type === 'wifi',
      isCellular: type === 'cellular',
      generation,
    };
  } catch {
    return {
      isConnected: true,
      isWifi: false,
      isCellular: false,
      generation: 'unknown',
    };
  }
}

export function isSlowNetwork(profile: NetworkProfile): boolean {
  return profile.isCellular && (profile.generation === '2g' || profile.generation === '3g' || profile.generation === 'unknown');
}
