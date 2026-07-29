import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '../screens/HomeScreen';
import { StatusScreen } from '../screens/StatusScreen';

type RootStackParamList = {
  Home: undefined;
  Status: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          contentStyle: { backgroundColor: '#0b0d12' },
          headerStyle: { backgroundColor: '#0b0d12' },
          headerTintColor: '#f0f1f5',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="Home" options={{ title: 'Intermingled' }}>
          {({ navigation }) => <HomeScreen onOpenStatus={() => navigation.navigate('Status')} />}
        </Stack.Screen>
        <Stack.Screen name="Status" component={StatusScreen} options={{ title: 'Backend Status' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
