export interface Esp32Device {
    id: string;
    name: string;
    boardType: string;
    isConnected: boolean;
    ipAddress?: string;
}