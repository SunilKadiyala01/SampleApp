import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function HomeScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ESP32 Controller</Text>

      <Text style={styles.subtitle}>
        Connect and manage your ESP32 device
      </Text>

      <View style={styles.card}>
        <Text style={styles.deviceTitle}>My ESP32 Device</Text>

        <Text style={styles.status}>● Not Connected</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('WifiSetup')}
        >
          <Text style={styles.buttonText}>Configure Wi-Fi</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.detailsButton]}
          onPress={() => navigation.navigate('DeviceDetails')}
        >
          <Text style={styles.buttonText}>Device Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}




const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
    padding: 24,
    justifyContent: 'center',
  },
  detailsButton: {
    marginTop: 12,
    backgroundColor: '#0F766E',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#172554',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    elevation: 3,
  },
  deviceTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  status: {
    fontSize: 15,
    color: '#DC2626',
    marginTop: 14,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen;