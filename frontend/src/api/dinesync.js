import axios from 'axios';
import Constants from 'expo-constants';

// =========================
// AUTO GET HOST IP
// =========================

const debuggerHost =
  Constants.expoConfig?.hostUri ||
  Constants.manifest2?.extra
    ?.expoGo?.debuggerHost;

const host = debuggerHost
  ?.split(':')
  ?.shift();

// =========================
// AUTO BUILD API URL
// =========================

const BASE_URL =
  `http://${host}:3000/api`;

console.log(
  'Using API:',
  BASE_URL
);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// =========================
// DEFAULT TABLE NUMBER
// iPad = Table No. 1
// =========================

const TABLE_NUMBER = 1;

// =========================
// GET MENU
// =========================

export const getMenu = async () => {
  const response =
    await api.get('/menu');

  return response.data;
};

// =========================
// GET TABLE
// =========================

export const getTable = async (
  tableNumber = TABLE_NUMBER
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
  cartItems
) => {
  const payload = {
    table_number: TABLE_NUMBER,

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

    status: 'pending',
  };

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

export default api;