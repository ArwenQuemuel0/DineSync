import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =========================
// DEV NODE BACKEND API
// =========================

const BACKEND_PORT = 3000;

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

console.log(
  '=============================='
);

console.log(
  'DINESYNC DEV NODE API:',
  BASE_URL
);

console.log(
  '=============================='
);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
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
// HELPERS
// =========================

const VALID_NORMAL_INVENTORY_TYPES = [
  'per_order',
  'per_head',
];

const MENU_CACHE_KEYS = [
  'menu',
  'menuItems',
  'cachedMenu',
  'cachedMenuItems',
  'dinesync_menu',
  'dinesync_menu_items',
];

const clearKnownMenuCaches = async () => {
  try {
    await AsyncStorage.multiRemove(
      MENU_CACHE_KEYS
    );
  } catch (error) {
    console.log(
      'CLEAR MENU CACHE WARNING:',
      error?.message || error
    );
  }
};

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

const toNumberOrZero = (value) => {
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

const isCustomCartItem = (item) => {
  const category =
    normalizeText(item?.category);

  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  const name =
    normalizeText(item?.name);

  return (
    category === 'chef oppa special' ||
    inventoryType === 'custom' ||
    name.includes(
      'custom chef oppa special'
    )
  );
};

const getMobileMaxQuantity = (item) => {
  if (!item) {
    return 0;
  }

  if (isCustomCartItem(item)) {
    return 1;
  }

  const maxQuantity =
    Number(
      item?.max_order_quantity ??
        item?.remaining_today ??
        1
    );

  return Number.isFinite(maxQuantity)
    ? Math.max(0, maxQuantity)
    : 1;
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
    maxOrderQuantity ??
    remainingToday ??
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
        ? String(
            item.stock_label
          ).trim()
        : null,

    is_available:
      item?.is_available,

    flavor_tags:
      Array.isArray(
        item?.flavor_tags
      )
        ? item.flavor_tags
        : item?.flavor_tags
          ? String(item.flavor_tags)
              .split(',')
              .map((tag) =>
                tag.trim()
              )
              .filter(Boolean)
          : [],

    meal_type:
      item?.meal_type
        ? String(
            item.meal_type
          ).trim()
        : null,
  };
};

const isValidDailyInventoryMenuItem = (item) => {
  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  if (
    !isAvailableTrue(
      item?.is_available
    )
  ) {
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

  return getMobileMaxQuantity(item) > 0;
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
    getMobileMaxQuantity(item) <= 0
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
      isCustomCartItem(
        normalizedItem
      );

    const quantity =
      custom
        ? 1
        : toNumberOrZero(
            normalizedItem.quantity
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

    const maxQuantity =
      getMobileMaxQuantity(
        normalizedItem
      );

    if (maxQuantity <= 0) {
      throw new Error(
        `${normalizedItem?.name || 'This item'} is sold out for today.`
      );
    }

    if (quantity <= 0) {
      throw new Error(
        `${normalizedItem?.name || 'This item'} has invalid quantity.`
      );
    }

    if (quantity > maxQuantity) {
      throw new Error(
        `${normalizedItem?.name || 'This item'} only has ${maxQuantity} available today.`
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
// TABLE ONLINE / HEARTBEAT / OFFLINE
// =========================

export const tableOnline = async () => {
  const response =
    await api.post('/table/online');

  return response.data;
};

export const tableHeartbeat = async () => {
  const response =
    await api.post('/table/heartbeat');

  return response.data;
};

export const tableOffline = async () => {
  const response =
    await api.post('/table/offline');

  return response.data;
};

// =========================
// TABLE STATUS
// =========================

export const getTableStatus = async () => {
  const response =
    await api.get('/table/status');

  return response.data;
};

// =========================
// TABLE ORDER HISTORY
// =========================

export const getTableOrderHistory = async () => {
  const response =
    await api.get('/table/order-history');

  return response.data;
};

// =========================
// GET MENU FROM DEV NODE API
// =========================

export const getMenu = async () => {
  await clearKnownMenuCaches();

  const response =
    await api.get('/menu', {
      params: {
        _ts: Date.now(),
      },
    });

  console.log(
    'DEV NODE MENU RESPONSE:',
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

    const bibimbap =
      visibleItems.find(
        (item) =>
          String(item.name || '')
            .trim()
            .toLowerCase() ===
          'bibimbap'
      );

    if (bibimbap) {
      const maxQuantity =
        getMobileMaxQuantity(
          bibimbap
        );

      console.log(
        'API ITEM:',
        bibimbap
      );

      console.log(
        'MAX ORDER QUANTITY:',
        bibimbap?.max_order_quantity
      );

      console.log(
        'REMAINING TODAY:',
        bibimbap?.remaining_today
      );

      console.log(
        'FINAL MAX QUANTITY:',
        maxQuantity
      );
    }

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

// =========================
// PAYMENT NORMALIZATION
// =========================

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

export const processPayment = async (
  paymentData
) => {
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

export const getOrderStatus = async (
  orderId
) => {
  const response =
    await api.get(
      `/orders/${orderId}`
    );

  return response.data;
};

// =========================
// GET ACTIVE TABLE ORDERS
// =========================

export const getActiveTableOrders = async (
  tableNumber
) => {
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