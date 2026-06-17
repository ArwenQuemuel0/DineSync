import 'react-native-gesture-handler';

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthProvider } from './src/context/AuthContext';
import { TableStatusProvider } from './src/context/TableStatusContext';
import { CartProvider } from './src/context/CartContext';

import LoginScreen from './src/screens/LoginScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import MenuScreen from './src/screens/MenuScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import PaymentWebViewScreen from './src/screens/PaymentWebViewScreen';
import OrderConfirmScreen from './src/screens/OrderConfirmScreen';
import OrderStatusScreen from './src/screens/OrderStatusScreen';
import OrderHistoryScreen from './src/screens/OrderHistoryScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AuthProvider>
      <TableStatusProvider>
        <CartProvider>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="Login"
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen
                name="Login"
                component={LoginScreen}
              />

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
                name="OrderConfirm"
                component={OrderConfirmScreen}
              />

              <Stack.Screen
                name="PaymentWebView"
                component={PaymentWebViewScreen}
              />

              <Stack.Screen
                name="OrderStatus"
                component={OrderStatusScreen}
              />

              <Stack.Screen
                name="OrderHistory"
                component={OrderHistoryScreen}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </CartProvider>
      </TableStatusProvider>
    </AuthProvider>
  );
}