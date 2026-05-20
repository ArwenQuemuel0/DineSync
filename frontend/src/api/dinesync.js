import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =========================
// NODE BACKEND PORT
// =========================

const BACKEND_PORT = 3000;

// =========================
// AUTO GET HOST IP
// =========================

const debuggerHost =
  Constants.expoConfig?.hostUri ||
  Constants.manifest2?.extra
    ?.expoGo?.debuggerHost;

const host =
  debuggerHost
    ?.split(':')
    ?.shift() || 'localhost';

// =========================
// AUTO BUILD API URL
// =========================

const BASE_URL =
  `http://${host}:${BACKEND_PORT}/api`;

console.log(
  '=============================='
);

console.log(
  'DINESYNC NODE API:',
  BASE_URL
);

console.log(
  '=============================='
);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// =========================
// AUTO ATTACH TOKEN
// =========================

api.interceptors.request.use(
  async (config) => {
    const token =
      await AsyncStorage.getItem('token');

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    console.log(
      'API REQUEST:',
      config.method?.toUpperCase(),
      `${BASE_URL}${config.url}`
    );

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// =========================
// LOGIN
// =========================

export const loginUser = async (
  email,
  password
) => {
  const response =
    await api.post('/login', {
      email,
      password,
    });

  return response.data;
};

// =========================
// TABLE ONLINE
// =========================

export const tableOnline = async () => {
  const response =
    await api.post('/table/online');

  return response.data;
};

// =========================
// TABLE HEARTBEAT
// =========================

export const tableHeartbeat = async () => {
  const response =
    await api.post('/table/heartbeat');

  return response.data;
};

// =========================
// TABLE OFFLINE
// =========================

export const tableOffline = async () => {
  const response =
    await api.post('/table/offline');

  return response.data;
};

// =========================
// TABLE ORDER HISTORY
// Uses logged-in table token/session
// Backend detects table number
// =========================

export const getTableOrderHistory = async () => {
  const response =
    await api.get('/table/order-history');

  return response.data;
};

// =========================
// GET MENU
// =========================

export const getMenu = async () => {
  const response =
    await api.get('/menu');

  console.log(
    'MENU RESPONSE:',
    response.data
  );

  return response.data;
};

// =========================
// GET TABLE
// =========================

export const getTable = async (
  tableNumber
) => {
  const response =
    await api.get(
      `/tables/${tableNumber}`
    );

  return response.data;
};

// =========================
// PLACE ORDER
// =========================

export const placeOrder = async (
  cartItems,
  tableNumber
) => {
  if (!tableNumber) {
    throw new Error(
      'Table number is missing. Please login using a table account.'
    );
  }

  const payload = {
    table_number: tableNumber,

    items: cartItems.map(
      (item) => ({
        menu_item_id:
          item.menu_item_id ||
          item.id,

        quantity:
          item.quantity,

        price:
          Number(item.price) || 0,
      })
    ),

    // Mobile can send this,
    // but backend should still force pending.
    status: 'pending',
  };

  console.log(
    'ORDER PAYLOAD:',
    payload
  );

  const response =
    await api.post(
      '/orders',
      payload
    );

  return response.data;
};

// =========================
// PROCESS PAYMENT
// =========================

export const processPayment =
  async (paymentData) => {
    const response =
      await api.post(
        '/payments',
        paymentData
      );

    return response.data;
  };

// =========================
// GET ORDER STATUS
// =========================

export const getOrderStatus =
  async (orderId) => {
    const response =
      await api.get(
        `/orders/${orderId}`
      );

    return response.data;
  };

// =========================
// GET ACTIVE TABLE ORDERS
// Connected to database through Node backend
// =========================

export const getActiveTableOrders =
  async (tableNumber) => {
    const response =
      await api.get(
        `/orders/table/${tableNumber}/active`
      );

    return response.data;
  };

// =========================
// AI DISH RECOMMENDATIONS
// =========================

export const getDishRecommendations =
  async ({
    selectedItem,
    cartItems = [],
  }) => {
    const response =
      await api.post(
        '/ai/recommend-dishes',
        {
          selected_item: selectedItem,
          cart_items: cartItems,
        }
      );

    return response.data;
  };

export default api;