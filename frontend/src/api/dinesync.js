import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =========================
// NODE BACKEND PORT
// =========================

const BACKEND_PORT = 3000;

// =========================
// API BASE URL
// =========================
//
// Development using Expo:
// const BASE_URL = `http://${host}:${BACKEND_PORT}/api`;
//
// APK / Hosted backend:
// const BASE_URL = 'https://api.dinesync.shop/api';
//
// For now, auto local IP muna.
// Kapag final APK na, palitan mo BASE_URL sa hosted API.
// =========================

const debuggerHost =
  Constants.expoConfig?.hostUri ||
  Constants.manifest2?.extra
    ?.expoGo?.debuggerHost;

const host =
  debuggerHost
    ?.split(':')
    ?.shift() || 'localhost';

const BASE_URL =
  `http://${host}:${BACKEND_PORT}/api`;

// Final APK hosted backend version:
// const BASE_URL = 'https://api.dinesync.shop/api';

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
// PARSERS / NORMALIZERS
// =========================

const VALID_NORMAL_INVENTORY_TYPES = [
  'per_order',
  'per_head',
];

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase();
};

const normalizeInventoryType = (value) => {
  return normalizeText(value)
    .replace(/[-\s]+/g, '_');
};

const parseNumeric = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const numeric =
    Number(value);

  return Number.isFinite(numeric)
    ? numeric
    : null;
};

const toNumber = (value) => {
  const numeric =
    Number(value);

  return Number.isFinite(numeric)
    ? numeric
    : 0;
};

const isAvailableTrue = (value) => {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    normalizeText(value) === 'true' ||
    normalizeText(value) === 'yes' ||
    normalizeText(value) === 'available'
  );
};

const hasInventoryType = (item) => {
  return (
    item?.inventory_type !== null &&
    item?.inventory_type !== undefined &&
    String(item.inventory_type).trim() !== ''
  );
};

const hasDailyLimit = (item) => {
  return (
    item?.daily_limit !== null &&
    item?.daily_limit !== undefined &&
    String(item.daily_limit).trim() !== ''
  );
};

const getRemainingToday = (item) => {
  return toNumber(
    item?.remaining_today
  );
};

const getMaxOrderQuantity = (item) => {
  return toNumber(
    item?.max_order_quantity
  );
};

const getAllowedOrderQuantity = (item) => {
  if (!item) {
    return 0;
  }

  if (isCustomCartItem(item)) {
    return 1;
  }

  const maxOrderQuantity =
    getMaxOrderQuantity(item);

  const remainingToday =
    getRemainingToday(item);

  if (
    maxOrderQuantity > 0 &&
    remainingToday > 0
  ) {
    return Math.min(
      maxOrderQuantity,
      remainingToday
    );
  }

  if (maxOrderQuantity > 0) {
    return maxOrderQuantity;
  }

  if (remainingToday > 0) {
    return remainingToday;
  }

  return 0;
};

const normalizeMenuItem = (item) => {
  const inventoryType =
    item?.inventory_type
      ? normalizeInventoryType(
          item.inventory_type
        )
      : null;

  const dailyLimit =
    parseNumeric(
      item?.daily_limit
    );

  const soldToday =
    parseNumeric(
      item?.sold_today
    );

  const remainingToday =
    parseNumeric(
      item?.remaining_today
    );

  const maxOrderQuantity =
    parseNumeric(
      item?.max_order_quantity
    );

  const availableQuantity =
    remainingToday ??
    maxOrderQuantity ??
    parseNumeric(
      item?.available_quantity
    );

  return {
    ...item,

    image:
      item?.image_url ||
      item?.image ||
      null,

    image_url:
      item?.image_url ||
      item?.image ||
      null,

    inventory_type:
      inventoryType,

    daily_limit:
      dailyLimit,

    sold_today:
      soldToday,

    remaining_today:
      remainingToday,

    max_order_quantity:
      maxOrderQuantity,

    available_quantity:
      availableQuantity,

    daily_inventory_label:
      item?.daily_inventory_label
        ? String(
            item.daily_inventory_label
          ).trim()
        : null,

    stock_label:
      item?.stock_label
        ? String(item.stock_label).trim()
        : null,

    is_available:
      item?.is_available,

    flavor_tags:
      Array.isArray(item?.flavor_tags)
        ? item.flavor_tags
        : item?.flavor_tags
          ? String(item.flavor_tags)
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],

    meal_type:
      item?.meal_type
        ? String(item.meal_type).trim()
        : null,
  };
};

const isCustomCartItem = (item) => {
  const category =
    String(item?.category || '')
      .trim()
      .toLowerCase();

  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  const name =
    String(item?.name || '')
      .trim()
      .toLowerCase();

  return (
    category === 'chef oppa special' ||
    inventoryType === 'custom' ||
    name.includes(
      'custom chef oppa special'
    )
  );
};

const isValidDailyInventoryMenuItem = (item) => {
  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  const available =
    isAvailableTrue(
      item?.is_available
    );

  if (!available) {
    return false;
  }

  if (!hasInventoryType(item)) {
    return false;
  }

  if (inventoryType === 'custom') {
    return true;
  }

  if (
    !VALID_NORMAL_INVENTORY_TYPES.includes(
      inventoryType
    )
  ) {
    return false;
  }

  if (!hasDailyLimit(item)) {
    return false;
  }

  const remainingToday =
    getRemainingToday(item);

  const maxOrderQuantity =
    getMaxOrderQuantity(item);

  return (
    remainingToday > 0 ||
    maxOrderQuantity > 0
  );
};

const getDailyInventoryErrorMessage = (item) => {
  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  if (
    !isAvailableTrue(
      item?.is_available
    )
  ) {
    return `${item?.name || 'This item'} is currently unavailable.`;
  }

  if (!hasInventoryType(item)) {
    return `${item?.name || 'This item'} is not enabled in Daily Menu Inventory.`;
  }

  if (
    inventoryType !== 'custom' &&
    !VALID_NORMAL_INVENTORY_TYPES.includes(
      inventoryType
    )
  ) {
    return `${item?.name || 'This item'} has an invalid inventory type.`;
  }

  if (
    inventoryType !== 'custom' &&
    !hasDailyLimit(item)
  ) {
    return `${item?.name || 'This item'} has no daily limit set.`;
  }

  if (
    inventoryType !== 'custom' &&
    getAllowedOrderQuantity(item) <= 0
  ) {
    return `${item?.name || 'This item'} is sold out for today.`;
  }

  return `${item?.name || 'This item'} is not available today.`;
};

const validateCartBeforeOrder = (
  cartItems = []
) => {
  if (
    !Array.isArray(cartItems) ||
    cartItems.length === 0
  ) {
    throw new Error(
      'Please add at least one item before confirming your order.'
    );
  }

  for (const item of cartItems) {
    const normalizedItem =
      normalizeMenuItem(item);

    const custom =
      isCustomCartItem(normalizedItem);

    const quantity =
      custom
        ? 1
        : Number(
            normalizedItem.quantity || 0
          );

    if (
      !isValidDailyInventoryMenuItem(
        normalizedItem
      )
    ) {
      throw new Error(
        getDailyInventoryErrorMessage(
          normalizedItem
        )
      );
    }

    if (custom) {
      if (quantity !== 1) {
        throw new Error(
          'Chef Oppa Special request quantity must be 1 only.'
        );
      }

      continue;
    }

    const allowedQuantity =
      getAllowedOrderQuantity(
        normalizedItem
      );

    if (allowedQuantity <= 0) {
      throw new Error(
        `${normalizedItem?.name || 'This item'} is sold out for today.`
      );
    }

    if (quantity <= 0) {
      throw new Error(
        `${normalizedItem?.name || 'This item'} has invalid quantity.`
      );
    }

    if (quantity > allowedQuantity) {
      throw new Error(
        `${normalizedItem?.name || 'This item'} only has ${allowedQuantity} available today.`
      );
    }
  }

  return true;
};

export const extractApiErrorMessage = (
  error,
  fallback = 'Something went wrong. Please try again.'
) => {
  const data =
    error?.response?.data;

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
// Daily Menu Inventory rule:
// Only return items enabled for mobile.
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
    const normalizedItems =
      response.data.data.map(
        normalizeMenuItem
      );

    const visibleItems =
      normalizedItems.filter(
        isValidDailyInventoryMenuItem
      );

    console.log(
      'MOBILE DAILY MENU FILTER:',
      {
        raw_count:
          normalizedItems.length,
        visible_count:
          visibleItems.length,
      }
    );

    response.data.data =
      visibleItems;
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

const normalizePaymentMethodForOrder = (
  paymentMethod
) => {
  const normalized =
    String(paymentMethod || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');

  if (
    normalized === 'qr ph' ||
    normalized === 'qrph' ||
    normalized === 'xendit' ||
    normalized === 'online payment' ||
    normalized === 'electronic payment' ||
    normalized === 'digital payment'
  ) {
    return 'Digital Payment';
  }

  if (
    normalized === 'pay at counter' ||
    normalized === 'pay counter' ||
    normalized === 'counter' ||
    normalized === 'cashier'
  ) {
    return 'Pay at Counter';
  }

  if (
    normalized === 'pay later' ||
    normalized === 'later'
  ) {
    return 'Pay Later';
  }

  if (normalized === 'cash') {
    return 'Cash';
  }

  return 'Pay Later';
};

const getInitialOrderStatus = (
  paymentMethod
) => {
  const normalizedMethod =
    normalizePaymentMethodForOrder(
      paymentMethod
    );

  if (normalizedMethod === 'Pay Later') {
    return 'pending';
  }

  if (
    normalizedMethod === 'Pay at Counter' ||
    normalizedMethod === 'Digital Payment'
  ) {
    return 'awaiting_payment';
  }

  return 'pending';
};

// =========================
// PLACE ORDER
// =========================
//
// Pay Later:
// payment_method = "Pay Later"
// payment_status = "pending"
// status = "pending"
// Goes to KDS immediately.
//
// Pay at Counter:
// payment_method = "Pay at Counter"
// payment_status = "pending"
// status = "awaiting_payment"
// Does not go to KDS yet.
//
// QR PH:
// payment_method = "Digital Payment"
// payment_status = "pending"
// status = "awaiting_payment"
// Create order first, then backend returns Xendit checkout link.
// Does not go to KDS until payment is confirmed.
//
// Chef Oppa Special/custom:
// quantity = 1
// price = 0
// QR PH disabled from Confirm screen
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

  validateCartBeforeOrder(
    cartItems
  );

  const normalizedPaymentMethod =
    normalizePaymentMethodForOrder(
      paymentMethod
    );

  const hasCustomRequest =
    cartItems.some(
      isCustomCartItem
    );

  if (
    hasCustomRequest &&
    normalizedPaymentMethod === 'Digital Payment'
  ) {
    throw new Error(
      'QR PH is not available for Chef Oppa Special requests.'
    );
  }

  const initialStatus =
    getInitialOrderStatus(
      normalizedPaymentMethod
    );

  console.log(
    'PLACE ORDER PAYMENT CHECK:',
    {
      rawPaymentMethod:
        paymentMethod,
      normalizedPaymentMethod,
      initialStatus,
    }
  );

  if (
    normalizedPaymentMethod === 'Digital Payment' &&
    initialStatus !== 'awaiting_payment'
  ) {
    throw new Error(
      'Digital Payment must create an awaiting_payment order.'
    );
  }

  if (
    normalizedPaymentMethod === 'Pay Later' &&
    initialStatus !== 'pending'
  ) {
    throw new Error(
      'Pay Later must create a pending order.'
    );
  }

  const items =
    cartItems.map((item) => {
      const normalizedItem =
        normalizeMenuItem(item);

      const custom =
        isCustomCartItem(
          normalizedItem
        );

      const specialRequest =
        normalizedItem.special_request ||
        normalizedItem.notes ||
        '';

      if (custom) {
        return {
          menu_item_id:
            normalizedItem.menu_item_id ||
            normalizedItem.id,

          quantity: 1,

          price: 0,

          notes:
            specialRequest,

          special_request:
            specialRequest,
        };
      }

      return {
        menu_item_id:
          normalizedItem.menu_item_id ||
          normalizedItem.id,

        quantity:
          Number(
            normalizedItem.quantity
          ) || 1,

        price:
          Number(
            normalizedItem.price
          ) || 0,
      };
    });

  const totalAmount =
    cartItems.reduce(
      (sum, item) => {
        const normalizedItem =
          normalizeMenuItem(item);

        if (
          isCustomCartItem(
            normalizedItem
          )
        ) {
          return sum;
        }

        const price =
          Number(
            normalizedItem.price
          ) || 0;

        const quantity =
          Number(
            normalizedItem.quantity
          ) || 0;

        return sum + price * quantity;
      },
      0
    );

  const payload = {
    table_number:
      tableNumber,
    items,
    total_amount:
      totalAmount,
    payment_method:
      normalizedPaymentMethod,
    payment_status:
      'pending',
    status:
      initialStatus,
  };

  console.log(
    'ORDER PAYLOAD:',
    JSON.stringify(
      payload,
      null,
      2
    )
  );

  const response =
    await api.post(
      '/orders',
      payload
    );

  console.log(
    'ORDER RESPONSE:',
    JSON.stringify(
      response.data,
      null,
      2
    )
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
// Only return recommended dishes enabled
// by Daily Menu Inventory.
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
            normalizeMenuItem(
              selectedItem
            ),

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
      const normalizedItems =
        response.data.data.map(
          normalizeMenuItem
        );

      response.data.data =
        normalizedItems.filter(
          isValidDailyInventoryMenuItem
        );
    }

    return response.data;
  };

export default api;