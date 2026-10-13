export interface WifiNetwork {
  SSID: string;
  BSSID: string;
  capabilities: string;
  level: number;
  frequency: number;
  timestamp?: number;
}

export interface ConnectedWifiDetails {
  ssid: string;
  ipAddress: string;
  boardIpAddress: string;
  frequency: number;
}
