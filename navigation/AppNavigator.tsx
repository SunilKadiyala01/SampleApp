import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../src/screens/HomeScreen';
import WifiSetupScreen from '../src/screens/wifi/WifiSetupScreen';
import DeviceDetailsScreen from '../src/screens/device/DeviceDetailsScreen';
export type RootStackParamList = {
    Home: undefined;
    WifiSetup: undefined;
    DeviceDetails: undefined;

};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator(): React.JSX.Element {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Home">
                <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{ title: 'Home' }}
                />

                <Stack.Screen
                    name="WifiSetup"
                    component={WifiSetupScreen}
                    options={{ title: 'Configure Wi-Fi' }}
                />
                <Stack.Screen
                    name="DeviceDetails"
                    component={DeviceDetailsScreen}
                    options={{ title: 'Device Details' }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export default AppNavigator;