import { PermissionsAndroid, Platform } from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import type { WifiNetwork, ConnectedWifiDetails } from '../types/WifiNetwork';

export type { WifiNetwork, ConnectedWifiDetails };

/**
 * Request necessary permissions for Wi-Fi scanning on Android.
 */
export async function requestWifiPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const version =
      typeof Platform.Version === 'string'
        ? parseInt(Platform.Version, 10)
        : Platform.Version;

    if (version >= 33) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
      ]);

      const fineGranted =
        results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED;
      const nearbyGranted =
        results[PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES] ===
        PermissionsAndroid.RESULTS.GRANTED;

      return fineGranted || nearbyGranted;
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission Required',
          message:
            'Android requires Location permission to scan nearby Wi-Fi networks and boards.',
          buttonPositive: 'Grant Permission',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (error) {
    console.error('Permission request failed:', error);
    return false;
  }
}

/**
 * Fast Wi-Fi scanning.
 * Checks instant cached results first (<50ms).
 * If empty or fresh requested, performs active scan.
 */
export async function scanNearbyWifi(forceFresh = false): Promise<WifiNetwork[]> {
  try {
    const enabled = await WifiManager.isEnabled();
    if (!enabled) {
      throw new Error('Please turn on Wi-Fi on your phone.');
    }

    let rawList: any[] = [];

    // 1. If not forcing a full hardware scan, check cached list first (INSTANT - ~10ms!)
    if (!forceFresh) {
      try {
        const cached = await WifiManager.loadWifiList();
        if (Array.isArray(cached) && cached.length > 0) {
          rawList = cached;
        }
      } catch {
        // Fallback to active scan
      }
    }

    // 2. If cached was empty or fresh scan was explicitly requested, perform active re-scan
    if (rawList.length === 0) {
      try {
        const result = await WifiManager.reScanAndLoadWifiList();
        if (Array.isArray(result) && result.length > 0) {
          rawList = result;
        }
      } catch (scanErr) {
        console.warn('reScanAndLoadWifiList error, fallback to loadWifiList:', scanErr);
      }

      // If re-scan was throttled or empty, fallback to cached
      if (rawList.length === 0) {
        try {
          const cached = await WifiManager.loadWifiList();
          if (Array.isArray(cached)) {
            rawList = cached;
          }
        } catch {
          rawList = [];
        }
      }
    }

    // 3. Filter empty/hidden SSIDs and deduplicate by SSID
    const networkMap = new Map<string, WifiNetwork>();
    for (const item of rawList) {
      if (
        item &&
        typeof item.SSID === 'string' &&
        item.SSID.trim().length > 0
      ) {
        const ssid = item.SSID.trim();
        const existing = networkMap.get(ssid);
        const level = Number(item.level) || -100;

        if (!existing || level > existing.level) {
          networkMap.set(ssid, {
            SSID: ssid,
            BSSID: item.BSSID || '',
            capabilities: item.capabilities || '',
            level,
            frequency: Number(item.frequency) || 0,
            timestamp: item.timestamp,
          });
        }
      }
    }

    // Sort by signal strength descending (strongest first)
    const sorted = Array.from(networkMap.values()).sort(
      (a, b) => b.level - a.level,
    );

    return sorted;
  } catch (error) {
    console.error('Wi-Fi scan failed:', error);
    throw error;
  }
}

/**
 * Fast, reliable Wi-Fi connection.
 * - Saves network suggestions to phone so mobile stays on this Wi-Fi.
 * - Concurrently polls connection status so it resolves the second the phone connects (2-4s)
 * - Prevents premature timeout errors.
 */
export async function connectToWifiNetwork(
  ssid: string,
  password?: string | null,
): Promise<void> {
  const cleanSsid = ssid.trim();
  const cleanPassword = password ? password.trim() : '';

  // 1. Register with Android Network Suggestions (Android 10+ / API 29+)
  // This tells Android OS to remember the Wi-Fi credentials so phone stays on it
  if (Platform.OS === 'android' && Number(Platform.Version) >= 29) {
    try {
      await WifiManager.suggestWifiNetwork([
        {
          ssid: cleanSsid,
          password: cleanPassword,
        },
      ]);
    } catch (sugErr) {
      console.warn('suggestWifiNetwork note:', sugErr);
    }
  }

  let hasConnected = false;

  // 2. Fast Polling: Detects the exact moment the phone connects (typically 2-4 seconds)
  const pollPromise = new Promise<void>((resolve) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 * 800ms = 24s maximum
    const timer = setInterval(async () => {
      attempts++;
      try {
        const currentSsid = await WifiManager.getCurrentWifiSSID();
        const normalizedCurrent = currentSsid ? currentSsid.replace(/"/g, '').trim() : '';
        if (normalizedCurrent === cleanSsid) {
          clearInterval(timer);
          hasConnected = true;
          resolve();
          return;
        }
      } catch {
        // Still connecting
      }

      if (attempts >= maxAttempts || hasConnected) {
        clearInterval(timer);
        resolve();
      }
    }, 800);
  });

  // 3. Initiate native connection
  const connectActionPromise = (async () => {
    try {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 29) {
        await WifiManager.connectToProtectedWifiSSID({
          ssid: cleanSsid,
          password: cleanPassword,
          isWEP: false,
          isHidden: false,
          timeout: 30, // 30 seconds to give Android time
        });
      } else {
        await WifiManager.connectToProtectedSSID(
          cleanSsid,
          cleanPassword || null,
          false,
          false,
        );
      }
      hasConnected = true;
    } catch (err: any) {
      // Check if phone actually connected despite timeout error
      try {
        const currentSsid = await WifiManager.getCurrentWifiSSID();
        const normalized = currentSsid ? currentSsid.replace(/"/g, '').trim() : '';
        if (normalized === cleanSsid) {
          hasConnected = true;
          return; // Connected successfully!
        }
      } catch {
        // Not connected
      }
      throw err;
    }
  })();

  // Race: Whichever detects connection first wins
  await Promise.race([
    connectActionPromise,
    new Promise((resolve) => {
      pollPromise.then(() => {
        if (hasConnected) resolve(true);
      });
    }),
  ]);

  // Route app traffic through this Wi-Fi so HTTP requests reach the board
  try {
    await WifiManager.forceWifiUsageWithOptions(true, { noInternet: true });
  } catch {
    // Ignored
  }
}

/**
 * Disconnect from the current Wi-Fi network and restore normal phone routing.
 */
export async function disconnectCurrentWifi(): Promise<boolean> {
  try {
    await WifiManager.disconnect();
    try {
      await WifiManager.forceWifiUsageWithOptions(false, { noInternet: false });
    } catch {
      // Ignored
    }
    return true;
  } catch (error) {
    console.error('Failed to disconnect:', error);
    return false;
  }
}

/**
 * Helper to calculate default gateway / board IP from the phone's assigned IP.
 * e.g., if phone IP is 192.168.4.2 -> board IP is 192.168.4.1
 */
export function estimateBoardIp(phoneIp: string): string {
  if (!phoneIp || phoneIp === '0.0.0.0') {
    return '192.168.4.1';
  }
  const parts = phoneIp.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.1`;
  }
  return '192.168.4.1';
}

/**
 * Get details of the currently connected Wi-Fi network and IPs.
 */
export async function getConnectedWifiDetails(): Promise<ConnectedWifiDetails> {
  const ssid = await WifiManager.getCurrentWifiSSID();
  const ipAddress = await WifiManager.getIP();
  const frequency = await WifiManager.getFrequency();
  const boardIpAddress = estimateBoardIp(ipAddress);

  return {
    ssid: ssid ? ssid.replace(/"/g, '') : '',
    ipAddress,
    boardIpAddress,
    frequency,
  };
}