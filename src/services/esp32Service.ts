import type { Esp32Device } from '../types/Esp32Device';

const defaultDevice: Esp32Device = {
    id: 'esp32-001',
    name: 'My ESP32 Device',
    boardType: 'ESP32',
    isConnected: false,
};

export function getDeviceDetails(): Esp32Device {
    return defaultDevice;
}

export async function fetchBoardResponse(
    boardIp: string,
): Promise<unknown> {
    const response = await fetch(`http://${boardIp}/status`);

    if (!response.ok) {
        throw new Error(`Board returned HTTP ${response.status}`);
    }

    return response.json();
}