import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =========================
// HOSTED NODE BACKEND API
// =========================

const BASE_URL =
  'https://api.dinesync.shop/api';

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

const toNumberOrZero = (value) => {
  const numeric =
    Number(value);

  return Number.isFinite(numeric)
    ? numeric
    : 0;
};

const parseNumericOrZero = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return 0;
  }

  return toNumberOrZero(value);
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
        item?.available_quantity ??
        0
    );

  return Number.isFinite(maxQuantity)
    ? Math.max(0, maxQuantity)
    : 0;
};

const getMobileRemainingQuantity = (item) => {
  if (!item) {
    return 0;
  }

  if (isCustomCartItem(item)) {
    return 1;
  }

  const remainingQuantity =
    Number(
      item?.remaining_today ??
        item?.available_quantity ??
        item?.max_order_quantity ??
        0
    );

  return Number.isFinite(remainingQuantity)
    ? Math.max(0, remainingQuantity)
    : 0;
};

const normalizeFlavorTags = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((tag) =>
        String(tag).trim()
      )
      .filter(Boolean);
  }

  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const normalizeMenuItem = (item) => {
  const custom =
    isCustomCartItem(item);

  const maxOrderQuantity =
    custom
      ? 1
      : getMobileMaxQuantity(item);

  const remainingQuantity =
    custom
      ? 1
      : getMobileRemainingQuantity(item);

  const available =
    isAvailableTrue(
      item?.is_available
    ) &&
    (
      custom ||
      maxOrderQuantity > 0 ||
      remainingQuantity > 0
    );

  const image =
    item?.image_url ||
    item?.image ||
    null;

  return {
    ...item,

    id:
      item?.id ??
      item?.menu_item_id,

    menu_item_id:
      item?.menu_item_id ??
      item?.id,

    image,
    image_url: image,

    inventory_type:
      custom
        ? 'custom'
        : item?.inventory_type
          ? normalizeInventoryType(
              item.inventory_type
            )
          : 'ingredient',

    price:
      parseNumericOrZero(
        item?.price
      ),

    max_order_quantity:
      available
        ? maxOrderQuantity
        : 0,

    remaining_today:
      available
        ? remainingQuantity
        : 0,

    available_quantity:
      available
        ? maxOrderQuantity
        : 0,

    stock_label:
      item?.stock_label
        ? String(
            item.stock_label
          ).trim()
        : available
          ? custom
            ? 'Staff confirms'
            : `${maxOrderQuantity} order(s) available`
          : null,

    daily_inventory_label:
      item?.daily_inventory_label
        ? String(
            item.daily_inventory_label
          ).trim()
        : null,

    unavailable_reason:
      available
        ? null
        : item?.unavailable_reason ||
          item?.stock_label ||
          'Unavailable based on ingredient stock.',

    is_available:
      available,

    flavor_tags:
      normalizeFlavorTags(
        item?.flavor_tags
      ),

    meal_type:
      item?.meal_type
        ? String(
            item.meal_type
          ).trim()
        : null,
  };
};

const isValidIngredientInventoryMenuItem = (item) => {
  const normalizedItem =
    normalizeMenuItem(item);

  if (
    !isAvailableTrue(
      normalizedItem?.is_available
    )
  ) {
    return false;
  }

  if (
    isCustomCartItem(
      normalizedItem
    )
  ) {
    return true;
  }

  return (
    getMobileMaxQuantity(
      normalizedItem
    ) > 0 ||
    getMobileRemainingQuantity(
      normalizedItem
    ) > 0
  );
};

const getIngredientInventoryErrorMessage = (item) => {
  const normalizedItem =
    normalizeMenuItem(item);

  if (
    !isAvailableTrue(
      normalizedItem?.is_available
    )
  ) {
    return (
      normalizedItem?.unavailable_reason ||
      `${normalizedItem?.name || 'This item'} is currently unavailable based on ingredient stock.`
    );
  }

  if (
    !isCustomCartItem(
      normalizedItem
    ) &&
    getMobileMaxQuantity(
      normalizedItem
    ) <= 0
  ) {
    return `${normalizedItem?.name || 'This item'} is currently out of stock.`;
  }

  return `${normalizedItem?.name || 'This item'} is currently unavailable.`;
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
      !isValidIngredientInventoryMenuItem(
        normalizedItem
      )
    ) {
      throw new Error(
        getIngredientInventoryErrorMessage(
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
        `${normalizedItem?.name || 'This item'} is currently out of stock.`
      );
    }

    if (quantity <= 0) {
      throw new Error(
        `${normalizedItem?.name || 'This item'} has invalid quantity.`
      );
    }

    if (quantity > maxQuantity) {
      throw new Error(
        `${normalizedItem?.name || 'This item'} only has ${maxQuantity} available based on ingredient stock.`
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
// GET MENU FROM NODE API
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
    'NODE MENU RESPONSE:',
    {
      success:
        response.data?.success,
      debug_source:
        response.data?.debug_source,
      source_debug:
        response.data?.source_debug,
      raw_count:
        Array.isArray(
          response.data?.data
        )
          ? response.data.data.length
          : 0,
      first_item:
        response.data?.data?.[0]?.name,
      first_available:
        response.data?.data?.[0]?.is_available,
      first_max_qty:
        response.data?.data?.[0]?.max_order_quantity,
    }
  );

  if (
    response.data?.success &&
    Array.isArray(response.data.data)
  ) {
    const normalizedItems =
      response.data.data.map(
        normalizeMenuItem
      );

    console.log(
      'MOBILE INGREDIENT MENU NORMALIZED:',
      {
        raw_count:
          response.data.data.length,
        normalized_count:
          normalizedItems.length,
        first_item:
          normalizedItems?.[0]?.name,
        first_available:
          normalizedItems?.[0]?.is_available,
        first_max_qty:
          normalizedItems?.[0]?.max_order_quantity,
      }
    );

    response.data.data =
      normalizedItems;
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

const getInitialOrderStatus = () => {
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
    getInitialOrderStatus();

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
      response.data.data =
        response.data.data.map(
          normalizeMenuItem
        );
    }

    return response.data;
  };

export default api;