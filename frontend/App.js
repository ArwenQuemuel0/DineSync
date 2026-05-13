import 'react-native-gesture-handler';

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CartProvider } from './src/context/CartContext';

import WelcomeScreen from './src/screens/WelcomeScreen';
import MenuScreen from './src/screens/MenuScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import OrderStatusScreen from './src/screens/OrderStatusScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <CartProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
          />

          <Stack.Screen
            name="Menu"
            component={MenuScreen}
          />

          <Stack.Screen
            name="ItemDetail"
            component={ItemDetailScreen}
          />

          <Stack.Screen
            name="Payment"
            component={PaymentScreen}
          />

          <Stack.Screen
            name="OrderStatus"
            component={OrderStatusScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </CartProvider>
  );
}