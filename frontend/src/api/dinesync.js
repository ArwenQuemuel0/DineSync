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
// NORMALIZE MENU ITEM
// For AI dish recommendations
// =========================

const parseNumeric = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric)
    ? numeric
    : null;
};

const normalizeMenuItem = (item) => {
  // Trust API/web-provided inventory fields only.
  const maxOrderQuantity =
    parseNumeric(
      item?.max_order_quantity
    ) ??
    parseNumeric(
      item?.available_quantity
    );

  return {
    ...item,

    max_order_quantity:
      maxOrderQuantity,

    available_quantity:
      parseNumeric(
        item?.available_quantity
      ) ?? maxOrderQuantity,

    is_available: item?.is_available,

    stock_label: item?.stock_label
      ? String(item.stock_label).trim()
      : null,

    flavor_tags: Array.isArray(item?.flavor_tags)
      ? item.flavor_tags
      : item?.flavor_tags
        ? String(item.flavor_tags)
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],

    meal_type: item?.meal_type
      ? String(item.meal_type).trim()
      : null,
  };
};

export const extractApiErrorMessage = (
  error,
  fallback = 'Something went wrong. Please try again.'
) => {
  const data = error?.response?.data;

  if (!data) {
    return error?.message || fallback;
  }

  if (typeof data === 'string') {
    return data;
  }

  if (data.message) {
    return data.message;
  }

  if (data.error) {
    return typeof data.error === 'string'
      ? data.error
      : String(data.error);
  }

  if (
    data.errors &&
    typeof data.errors === 'object'
  ) {
    const firstKey =
      Object.keys(data.errors)[0];

    if (firstKey) {
      const firstError =
        data.errors[firstKey];

      if (
        Array.isArray(firstError) &&
        firstError[0]
      ) {
        return firstError[0];
      }

      if (typeof firstError === 'string') {
        return firstError;
      }
    }
  }

  return fallback;
};

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
// TABLE STATUS
// GET /api/table/status
// =========================

export const getTableStatus = async () => {
  const response =
    await api.get('/table/status');

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
// Includes flavor_tags and meal_type
// for AI dish recommendations
// =========================

export const getMenu = async () => {
  const response =
    await api.get('/menu');

  console.log(
    'MENU RESPONSE:',
    response.data
  );

  if (
    response.data?.success &&
    Array.isArray(response.data.data)
  ) {
    response.data.data =
      response.data.data.map(
        normalizeMenuItem
      );
  }

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
  tableNumber,
  paymentMethod
) => {
  if (!tableNumber) {
    throw new Error(
      'Table number is missing. Please login using a table account.'
    );
  }

  const payload = {
    table_number: tableNumber,
    payment_method: paymentMethod,
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
// Sends selected item and cart items
// with flavor_tags and meal_type included
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
          selected_item:
            normalizeMenuItem(selectedItem),

          cart_items:
            cartItems.map(
              normalizeMenuItem
            ),
        }
      );

    if (
      response.data?.success &&
      Array.isArray(
        response.data.data
      )
    ) {
      response.data.data =
        response.data.data.map(
          normalizeMenuItem
        );
    }

    return response.data;
  };

export default api;