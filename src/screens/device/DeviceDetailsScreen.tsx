import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { getDeviceDetails } from '../../services/esp32Service';
type Props = NativeStackScreenProps<
    RootStackParamList,
    'DeviceDetails'
>;

function DeviceDetailsScreen({ navigation }: Props): React.JSX.Element {
    const device = getDeviceDetails();
    return (
        <View style={styles.container}>
            <Text style={styles.title}>ESP32 Device Details</Text>

            <View style={styles.card}>
                <Text style={styles.label}>Device Name</Text>
                <Text style={styles.value}>{device.name}</Text>
                <Text style={styles.value}>{device.boardType}</Text>
                <Text style={styles.value}>ESP32</Text>

                <Text style={styles.label}>Connection Status</Text>
                <Text
                    style={[
                        styles.status,
                        { color: device.isConnected ? '#16A34A' : '#DC2626' },
                    ]}
                >
                    {device.isConnected ? 'Connected' : 'Not Connected'}
                </Text>
                <Text style={styles.note}>
                    Device information will appear here after connecting
                    and communicating with the ESP32 board.
                </Text>
            </View>

            <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.goBack()}
            >
                <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F4F6FA',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#172554',
        marginBottom: 20,
    },
    card: {
        backgroundColor: '#FFFFFF',
        padding: 18,
        borderRadius: 14,
        elevation: 2,
    },
    label: {
        color: '#64748B',
        fontSize: 14,
        marginTop: 12,
    },
    value: {
        color: '#1E293B',
        fontSize: 17,
        fontWeight: '600',
        marginTop: 4,
    },
    status: {
        color: '#DC2626',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 4,
    },
    note: {
        color: '#64748B',
        fontSize: 13,
        marginTop: 20,
        lineHeight: 20,
    },
    button: {
        backgroundColor: '#2563EB',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 20,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default DeviceDetailsScreen;