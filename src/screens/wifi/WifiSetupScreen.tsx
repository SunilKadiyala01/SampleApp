import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../navigation/AppNavigator';
import {
  scanNearbyWifi,
  requestWifiPermissions,
  getConnectedWifiDetails,
  connectToWifiNetwork,
  disconnectCurrentWifi,
  type ConnectedWifiDetails,
  type WifiNetwork,
} from '../../services/wifiService';
import {
  sendBoardRequest,
  sendHiMessageToBoard,
  type BoardResponseData,
} from '../../../api/esp32Api';

type Props = NativeStackScreenProps<RootStackParamList, 'WifiSetup'>;

function WifiSetupScreen({ navigation }: Props): React.JSX.Element {
  // Wi-Fi Scan & Connection States
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedNetwork, setSelectedNetwork] = useState<WifiNetwork | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Active Connection & IP Details
  const [connectedWifi, setConnectedWifi] = useState<ConnectedWifiDetails | null>(null);

  // Board Communication States
  const [protocol, setProtocol] = useState<'https' | 'http'>('http');
  const [boardIp, setBoardIp] = useState('192.168.4.1');
  const [endpoint, setEndpoint] = useState('/');
  const [hiFormat, setHiFormat] = useState<'text' | 'json' | 'get'>('text');

  // Custom Request States
  const [customPath, setCustomPath] = useState('/status');
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST'>('GET');
  const [customBody, setCustomBody] = useState('{\n  "message": "hi"\n}');

  // Request & Response States
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [responseResult, setResponseResult] = useState<BoardResponseData | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Fetch current Wi-Fi SSID and IP addresses
  const loadConnectedDetails = useCallback(async () => {
    try {
      const details = await getConnectedWifiDetails();
      if (details.ssid && details.ssid !== '<unknown ssid>') {
        setConnectedWifi(details);
        if (details.boardIpAddress) {
          setBoardIp(details.boardIpAddress);
        }
      } else {
        setConnectedWifi(null);
      }
    } catch {
      setConnectedWifi(null);
    }
  }, []);

  // Scan all nearby networks
  const scanWifi = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setConnectionMessage(null);

    try {
      const permissionGranted = await requestWifiPermissions();
      if (!permissionGranted) {
        Alert.alert(
          'Permissions Required',
          'Android requires Location and Nearby Devices permissions to scan for Wi-Fi networks.',
        );
        return;
      }

      const results = await scanNearbyWifi(isPullToRefresh);
      setNetworks(results);

      if (results.length === 0) {
        Alert.alert(
          'No Networks Found',
          '1. Ensure phone Wi-Fi is ON.\n2. Ensure phone Location (GPS) toggle is ON in quick settings.\n3. Pull down to refresh.',
        );
      }

      await loadConnectedDetails();
    } catch (error: any) {
      console.error('Scan error:', error);
      const errMsg = error?.message || String(error);

      if (errMsg.includes('Location service is turned off')) {
        Alert.alert(
          'Location (GPS) is OFF',
          'Android requires Location/GPS to be ON to scan Wi-Fi networks. Please turn on Location in quick settings.',
        );
      } else if (errMsg.includes('Please turn on Wi-Fi')) {
        Alert.alert('Wi-Fi is OFF', 'Please turn on Wi-Fi on your phone and try again.');
      } else {
        Alert.alert('Scan Failed', errMsg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadConnectedDetails]);

  // Initial scan on mount
  useEffect(() => {
    scanWifi(false);
  }, [scanWifi]);

  // Connect to the selected network with password
  const handleConnect = async () => {
    if (!selectedNetwork) return;

    setIsConnecting(true);
    setConnectionMessage({
      text: `Connecting to "${selectedNetwork.SSID}"... (If Android asks, please tap "Connect")`,
      isError: false,
    });

    try {
      await connectToWifiNetwork(selectedNetwork.SSID, password);

      setConnectionMessage({
        text: `Connected to "${selectedNetwork.SSID}"! Fetching IP address...`,
        isError: false,
      });

      // Reload IP addresses after connection
      await loadConnectedDetails();

      setConnectionMessage({
        text: `Successfully connected to "${selectedNetwork.SSID}"! You can now send "hi" to the board.`,
        isError: false,
      });
    } catch (error: any) {
      console.error('Connection error:', error);
      setConnectionMessage({
        text: error?.message || 'Connection failed. Please check the password.',
        isError: true,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from board Wi-Fi
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectCurrentWifi();
      setConnectedWifi(null);
      setConnectionMessage({ text: 'Disconnected from board Wi-Fi.', isError: false });
      await loadConnectedDetails();
    } catch (error: any) {
      Alert.alert('Disconnect Failed', error?.message || String(error));
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Quick Send "hi" to Board IP
  const handleSendHi = async () => {
    if (!boardIp.trim()) {
      Alert.alert('Board IP Required', 'Please enter the Board IP address.');
      return;
    }

    setIsSendingRequest(true);
    setRequestError(null);
    setResponseResult(null);

    try {
      const result = await sendHiMessageToBoard(
        boardIp.trim(),
        protocol,
        endpoint.trim() || '/',
        hiFormat,
      );
      setResponseResult(result);
    } catch (error: any) {
      console.error('Send "hi" failed:', error);
      setRequestError(error?.message || String(error));
    } finally {
      setIsSendingRequest(false);
    }
  };

  // Custom HTTP/HTTPS Request
  const handleSendCustomRequest = async () => {
    if (!boardIp.trim()) {
      Alert.alert('Board IP Required', 'Please enter the Board IP address.');
      return;
    }

    setIsSendingRequest(true);
    setRequestError(null);
    setResponseResult(null);

    try {
      const result = await sendBoardRequest({
        protocol,
        ip: boardIp.trim(),
        path: customPath.trim() || '/',
        method: httpMethod,
        body: httpMethod === 'POST' ? customBody : undefined,
        timeoutMs: 8000,
      });
      setResponseResult(result);
    } catch (error: any) {
      console.error('Board request failed:', error);
      setRequestError(error?.message || String(error));
    } finally {
      setIsSendingRequest(false);
    }
  };

  const getSignalBadge = (level: number) => {
    if (level >= -55) return { text: 'Strong', color: '#16A34A', bg: '#DCFCE7' };
    if (level >= -75) return { text: 'Good', color: '#2563EB', bg: '#DBEAFE' };
    if (level >= -85) return { text: 'Fair', color: '#D97706', bg: '#FEF3C7' };
    return { text: 'Weak', color: '#DC2626', bg: '#FEE2E2' };
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Board Wi-Fi & Comm</Text>
        <TouchableOpacity
          style={[styles.refreshIconButton, (loading || refreshing) && styles.buttonDisabled]}
          onPress={() => scanWifi(false)}
          disabled={loading || refreshing}
        >
          <Text style={styles.refreshIconText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={networks}
        keyExtractor={(item, index) => item.BSSID || `${item.SSID}-${index}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => scanWifi(true)}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
        ListHeaderComponent={
          <View>
            {/* 1. Connected Network & IP Details Banner */}
            {connectedWifi && connectedWifi.ssid ? (
              <View style={styles.connectedCard}>
                <View style={styles.connectedHeaderRow}>
                  <View style={styles.connectedDot} />
                  <Text style={styles.connectedTitle}>Connected to Board</Text>
                  <TouchableOpacity
                    style={[styles.disconnectBtn, isDisconnecting && styles.buttonDisabled]}
                    onPress={handleDisconnect}
                    disabled={isDisconnecting}
                  >
                    <Text style={styles.disconnectBtnText}>
                      {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.connectedSsid}>{connectedWifi.ssid}</Text>

                <View style={styles.ipDetailsGrid}>
                  <View style={styles.ipBox}>
                    <Text style={styles.ipBoxLabel}>Phone IP Address</Text>
                    <Text style={styles.ipBoxValue}>{connectedWifi.ipAddress || 'Unavailable'}</Text>
                  </View>
                  <View style={[styles.ipBox, styles.boardIpBox]}>
                    <Text style={styles.ipBoxLabel}>Board IP Address</Text>
                    <Text style={[styles.ipBoxValue, styles.boardIpValue]}>
                      {connectedWifi.boardIpAddress || '192.168.4.1'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* 2. SEND "HI" TO BOARD SECTION */}
            <View style={styles.hiCard}>
              <View style={styles.hiHeaderRow}>
                <Text style={styles.hiTitle}>👋 Send "hi" to Board IP</Text>
                {/* Protocol Toggle (HTTP / HTTPS) */}
                <View style={styles.protocolToggle}>
                  <TouchableOpacity
                    style={[styles.protocolBtn, protocol === 'http' && styles.protocolBtnActiveHttp]}
                    onPress={() => setProtocol('http')}
                  >
                    <Text style={[styles.protocolBtnText, protocol === 'http' && styles.protocolBtnTextActive]}>
                      HTTP
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.protocolBtn, protocol === 'https' && styles.protocolBtnActiveHttps]}
                    onPress={() => setProtocol('https')}
                  >
                    <Text style={[styles.protocolBtnText, protocol === 'https' && styles.protocolBtnTextActive]}>
                      HTTPS
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.hiSubtitle}>
                Sends a message to the connected board IP ({boardIp})
              </Text>

              {/* IP and Endpoint inputs */}
              <View style={styles.urlRow}>
                <Text style={styles.urlPrefix}>{protocol}://</Text>
                <TextInput
                  style={styles.urlIpInput}
                  value={boardIp}
                  onChangeText={setBoardIp}
                  placeholder="192.168.4.1"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.urlEndpointInput}
                  value={endpoint}
                  onChangeText={setEndpoint}
                  placeholder="/"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Hi Format Selector */}
              <View style={styles.hiFormatRow}>
                <Text style={styles.hiFormatLabel}>Format:</Text>
                <TouchableOpacity
                  style={[styles.formatChip, hiFormat === 'text' && styles.formatChipActive]}
                  onPress={() => setHiFormat('text')}
                >
                  <Text style={[styles.formatChipText, hiFormat === 'text' && styles.formatChipTextActive]}>
                    Text: "hi"
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formatChip, hiFormat === 'json' && styles.formatChipActive]}
                  onPress={() => setHiFormat('json')}
                >
                  <Text style={[styles.formatChipText, hiFormat === 'json' && styles.formatChipTextActive]}>
                    {`JSON: {"message":"hi"}`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formatChip, hiFormat === 'get' && styles.formatChipActive]}
                  onPress={() => setHiFormat('get')}
                >
                  <Text style={[styles.formatChipText, hiFormat === 'get' && styles.formatChipTextActive]}>
                    GET: ?msg=hi
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Send "hi" Button */}
              <TouchableOpacity
                style={[styles.sendHiBtn, isSendingRequest && styles.buttonDisabled]}
                onPress={handleSendHi}
                disabled={isSendingRequest}
              >
                {isSendingRequest ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.sendHiBtnText}>
                    🚀 Send "hi" to {boardIp}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Request Error Box */}
              {requestError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxTitle}>❌ Request Failed</Text>
                  <Text style={styles.errorBoxText}>{requestError}</Text>
                  <Text style={styles.errorBoxHint}>
                    Tip: Make sure you are connected to the board Wi-Fi. If using HTTPS, try HTTP if the board doesn't have SSL certificate.
                  </Text>
                </View>
              )}

              {/* Live Response Panel */}
              {responseResult && (
                <View style={styles.responseCard}>
                  <View style={styles.responseHeaderRow}>
                    <Text style={styles.responseCardTitle}>📥 Board Response</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>
                        {responseResult.status} {responseResult.statusText} • {responseResult.durationMs}ms
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.responseUrlText}>
                    {responseResult.method} {responseResult.url}
                  </Text>

                  <ScrollView style={styles.responseScrollView} nestedScrollEnabled>
                    <Text style={styles.responseBodyText}>
                      {typeof responseResult.data === 'object'
                        ? JSON.stringify(responseResult.data, null, 2)
                        : String(responseResult.data || '(Empty response)')}
                    </Text>
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Selected Network Password & Connect Card */}
            {selectedNetwork && (
              <View style={styles.connectCard}>
                <View style={styles.connectCardHeader}>
                  <Text style={styles.connectCardTitle}>Select Password & Connect</Text>
                  <Text style={styles.connectCardSsid} numberOfLines={1}>
                    "{selectedNetwork.SSID}"
                  </Text>
                </View>

                <TextInput
                  placeholder="Enter Wi-Fi password (leave blank if open)"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.passwordInput}
                />

                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.showPasswordBtn}
                >
                  <Text style={styles.showPasswordText}>
                    {showPassword ? '🙈 Hide Password' : '👁️ Show Password'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.connectBtn, isConnecting && styles.buttonDisabled]}
                  onPress={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.connectBtnText}>
                      Connect to "{selectedNetwork.SSID}"
                    </Text>
                  )}
                </TouchableOpacity>

                {connectionMessage && (
                  <View
                    style={[
                      styles.connectionMessageBox,
                      { backgroundColor: connectionMessage.isError ? '#FEE2E2' : '#DCFCE7' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.connectionMessageText,
                        { color: connectionMessage.isError ? '#B91C1C' : '#15803D' },
                      ]}
                    >
                      {connectionMessage.text}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 3. Nearby Wi-Fi List Header */}
            <Text style={styles.networksSectionTitle}>
              Nearest Networks (Select your board to connect)
            </Text>

            {loading && !refreshing && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Scanning nearby networks...</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Networks Found</Text>
              <Text style={styles.emptySubtitle}>
                • Make sure Wi-Fi is ON{'\n'}
                • Ensure Location (GPS) toggle is ON in quick settings{'\n'}
                • Pull down to refresh or tap "Refresh"
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => scanWifi(false)}>
                <Text style={styles.retryButtonText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const isSelected = selectedNetwork?.SSID === item.SSID;
          const badge = getSignalBadge(item.level);

          return (
            <TouchableOpacity
              style={[styles.networkCard, isSelected && styles.networkCardSelected]}
              onPress={() => {
                setSelectedNetwork(item);
                setPassword('');
                setConnectionMessage(null);
              }}
            >
              <View style={styles.networkInfo}>
                <View style={styles.networkTitleRow}>
                  <Text style={styles.networkName} numberOfLines={1}>
                    {item.SSID || '(Hidden Network)'}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
                  </View>
                </View>
                <Text style={styles.networkSub}>
                  Signal: {item.level} dBm • {item.frequency > 4000 ? '5 GHz' : '2.4 GHz'}
                </Text>
              </View>

              <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
                {isSelected && <View style={styles.selectCircleInner} />}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  refreshIconButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  refreshIconText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  connectedCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  connectedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  connectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
    marginRight: 8,
  },
  connectedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
    flex: 1,
  },
  disconnectBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  disconnectBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  connectedSsid: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  ipDetailsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  ipBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  boardIpBox: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  ipBoxLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  ipBoxValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  boardIpValue: {
    color: '#1D4ED8',
  },
  hiCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
  },
  hiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  hiTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  hiSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  protocolToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  protocolBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  protocolBtnActiveHttp: {
    backgroundColor: '#D97706',
  },
  protocolBtnActiveHttps: {
    backgroundColor: '#0F766E',
  },
  protocolBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  protocolBtnTextActive: {
    color: '#FFFFFF',
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  urlPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  urlIpInput: {
    flex: 1.2,
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  urlEndpointInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
    borderLeftWidth: 1,
    borderColor: '#E2E8F0',
  },
  hiFormatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  hiFormatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  formatChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formatChipActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  formatChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  formatChipTextActive: {
    color: '#FFFFFF',
  },
  sendHiBtn: {
    backgroundColor: '#0F766E',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendHiBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  errorBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 2,
  },
  errorBoxText: {
    fontSize: 12,
    color: '#B91C1C',
  },
  errorBoxHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontStyle: 'italic',
  },
  responseCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  responseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  responseCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  responseUrlText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  responseScrollView: {
    maxHeight: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  responseBodyText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#0F172A',
  },
  connectCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    elevation: 3,
  },
  connectCardHeader: {
    marginBottom: 8,
  },
  connectCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  connectCardSsid: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  showPasswordBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
  },
  showPasswordText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  connectBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  connectionMessageBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },
  connectionMessageText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  networksSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '500',
  },
  networkCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  networkCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  networkInfo: {
    flex: 1,
    marginRight: 10,
  },
  networkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  networkName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    marginRight: 6,
  },
  networkSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: {
    borderColor: '#2563EB',
  },
  selectCircleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default WifiSetupScreen;