import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =========================
// NODE BACKEND API
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

// IMPORTANT:
// For APK / physical tablet, do NOT use localhost.
// Keep hosted API here, or replace with laptop LAN IP while testing:
// const BASE_URL = `http://YOUR-LAPTOP-IP:${BACKEND_PORT}/api`;

const BASE_URL =
  'https://api.dinesync.shop/api';

const FIXED_LARAVEL_MENU_URL =
  'https://dinesync.shop/api/menu';

const EXPECTED_MENU_DEBUG_SOURCE =
  'WEB_MENU_INGREDIENT_AVAILABILITY_FIXED_2026';

console.log(
  '=============================='
);

console.log(
  'DINESYNC NODE API:',
  BASE_URL
);

console.log(
  'MENU FALLBACK API:',
  FIXED_LARAVEL_MENU_URL
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

const isAvailableFalse = (value) => {
  return (
    value === false ||
    value === 0 ||
    value === '0' ||
    normalizeText(value) === 'false' ||
    normalizeText(value) === 'no' ||
    normalizeText(value) === 'unavailable' ||
    normalizeText(value) === 'sold out'
  );
};

// =========================
// MENU RESPONSE PARSER
// =========================

const unwrapApiPayload = (payload) => {
  if (!payload) {
    return {};
  }

  if (
    payload.data &&
    payload.status &&
    payload.headers
  ) {
    return payload.data;
  }

  return payload;
};

const parseMenuItemsFromApiPayload = (
  payload
) => {
  const root =
    unwrapApiPayload(payload);

  if (Array.isArray(root)) {
    return root;
  }

  if (
    root &&
    Array.isArray(root.data)
  ) {
    return root.data;
  }

  if (
    root &&
    root.data &&
    Array.isArray(root.data.data)
  ) {
    return root.data.data;
  }

  if (
    root &&
    root.data &&
    root.data.data &&
    Array.isArray(root.data.data.data)
  ) {
    return root.data.data.data;
  }

  return [];
};

const getApiSuccess = (payload) => {
  const root =
    unwrapApiPayload(payload);

  return (
    root?.success === true ||
    root?.data?.success === true ||
    root?.data?.data?.success === true ||
    Array.isArray(root) ||
    Array.isArray(root?.data)
  );
};

const getApiDebugSource = (payload) => {
  const root =
    unwrapApiPayload(payload);

  return (
    root?.debug_source ||
    root?.data?.debug_source ||
    root?.data?.data?.debug_source ||
    null
  );
};

const fetchFixedLaravelMenu = async () => {
  const response =
    await axios.get(
      FIXED_LARAVEL_MENU_URL,
      {
        timeout: 20000,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        params: {
          _ts: Date.now(),
        },
      }
    );

  console.log(
    'MENU FALLBACK RAW:',
    response.data
  );

  console.log(
    'MENU FALLBACK DEBUG SOURCE:',
    getApiDebugSource(response.data)
  );

  return response;
};

const fetchMenuWithFallback = async () => {
  let response =
    await api.get('/menu', {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      params: {
        _ts: Date.now(),
      },
    });

  const primaryDebugSource =
    getApiDebugSource(response.data);

  console.log(
    'MENU PRIMARY RAW:',
    response.data
  );

  console.log(
    'MENU PRIMARY DEBUG SOURCE:',
    primaryDebugSource
  );

  if (
    primaryDebugSource !==
    EXPECTED_MENU_DEBUG_SOURCE
  ) {
    console.log(
      'OLD / STALE MOBILE API DETECTED. USING FIXED LARAVEL MENU FALLBACK.'
    );

    response =
      await fetchFixedLaravelMenu();
  }

  return response;
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
    return null;
  }

  if (isCustomCartItem(item)) {
    return 1;
  }

  const maxQuantity =
    parseNumeric(
      item?.max_order_quantity ??
        item?.available_quantity ??
        item?.remaining_today
    );

  if (maxQuantity === null) {
    return 0;
  }

  return Math.max(
    0,
    maxQuantity
  );
};

const getCartItemId = (item) => {
  return String(
    item?.menu_item_id ||
      item?.id ||
      ''
  );
};

const buildLatestMenuMap = (
  items = []
) => {
  return items.reduce(
    (map, item) => {
      const id =
        getCartItemId(item);

      if (id) {
        map[id] = item;
      }

      return map;
    },
    {}
  );
};

const normalizeBooleanAvailability = (
  value
) => {
  if (isAvailableTrue(value)) {
    return true;
  }

  if (isAvailableFalse(value)) {
    return false;
  }

  return value;
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
      item?.max_order_quantity ??
        item?.available_quantity ??
        item?.remaining_today
    );

  const availableQuantity =
    parseNumeric(
      item?.available_quantity ??
        item?.max_order_quantity ??
        item?.remaining_today
    );

  const normalizedIsAvailable =
    normalizeBooleanAvailability(
      item?.is_available
    );

  return {
    ...item,

    id:
      item?.id ??
      item?.menu_item_id,

    menu_item_id:
      item?.menu_item_id ??
      item?.id,

    name:
      item?.name || '',

    category:
      item?.category || '',

    price:
      Number(item?.price || 0),

    description:
      item?.description ||
      item?.item_description ||
      item?.details ||
      item?.desc ||
      '',

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

    unavailable_reason:
      item?.unavailable_reason
        ? String(
            item.unavailable_reason
          ).trim()
        : null,

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
      normalizedIsAvailable,

    ingredients:
      Array.isArray(item?.ingredients)
        ? item.ingredients
        : [],

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

const getStockMessage = (item) => {
  if (!item) {
    return 'This item is unavailable based on ingredient stock.';
  }

  const maxQuantity =
    getMobileMaxQuantity(item);

  const itemAvailable =
    item?.is_available === true &&
    maxQuantity > 0;

  if (itemAvailable) {
    return (
      item?.stock_label ||
      item?.daily_inventory_label ||
      `Only ${maxQuantity} order(s) available based on ingredient stock.`
    );
  }

  if (item?.unavailable_reason) {
    return String(
      item.unavailable_reason
    );
  }

  if (item?.stock_label) {
    return String(item.stock_label);
  }

  if (item?.daily_inventory_label) {
    return String(
      item.daily_inventory_label
    );
  }

  if (maxQuantity === 0) {
    return `${item?.name || 'This item'} is sold out based on ingredient stock.`;
  }

  return `${item?.name || 'This item'} is currently unavailable based on ingredient stock.`;
};

const isNormalItemOrderableByBackendStock = (
  item
) => {
  if (!item) {
    return false;
  }

  if (isCustomCartItem(item)) {
    return isAvailableTrue(
      item?.is_available
    );
  }

  const maxQuantity =
    getMobileMaxQuantity(item);

  return (
    item?.is_available === true &&
    maxQuantity > 0
  );
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
        ? Number(
            normalizedItem.quantity ||
              1
          )
        : toNumberOrZero(
            normalizedItem.quantity
          );

    if (custom) {
      if (quantity !== 1) {
        throw new Error(
          'Chef Oppa Special request quantity must be 1 only.'
        );
      }

      if (
        isAvailableFalse(
          normalizedItem?.is_available
        )
      ) {
        throw new Error(
          normalizedItem?.unavailable_reason ||
          'Chef Oppa Special is currently unavailable.'
        );
      }

      continue;
    }

    if (
      !isNormalItemOrderableByBackendStock(
        normalizedItem
      )
    ) {
      throw new Error(
        getStockMessage(
          normalizedItem
        )
      );
    }

    const maxQuantity =
      getMobileMaxQuantity(
        normalizedItem
      );

    if (quantity <= 0) {
      throw new Error(
        `${normalizedItem?.name || 'This item'} has invalid quantity.`
      );
    }

    if (
      maxQuantity !== null &&
      quantity > maxQuantity
    ) {
      throw new Error(
        `${normalizedItem?.name || 'This item'} only has ${maxQuantity} order(s) available based on ingredient stock. Please reduce the quantity.`
      );
    }
  }

  return true;
};

export const validateCartAgainstLatestMenu =
  async (cartItems = []) => {
    if (
      !Array.isArray(cartItems) ||
      cartItems.length === 0
    ) {
      throw new Error(
        'Please add at least one item before confirming your order.'
      );
    }

    let response;

    try {
      response =
        await fetchMenuWithFallback();
    } catch (error) {
      console.log(
        'VERIFY MENU ERROR:',
        error?.response?.data ||
          error?.message ||
          error
      );

      throw new Error(
        'Unable to verify latest stock. Please try again.'
      );
    }

    console.log(
      'VERIFY MENU API RAW:',
      response.data
    );

    const latestRawItems =
      parseMenuItemsFromApiPayload(
        response.data
      );

    console.log(
      'VERIFY MENU ITEMS:',
      latestRawItems
    );

    if (
      !getApiSuccess(response.data) ||
      !Array.isArray(latestRawItems)
    ) {
      throw new Error(
        'Unable to verify latest stock. Please try again.'
      );
    }

    const latestItems =
      latestRawItems.map(
        normalizeMenuItem
      );

    const latestMap =
      buildLatestMenuMap(
        latestItems
      );

    for (const cartItem of cartItems) {
      const normalizedCartItem =
        normalizeMenuItem(cartItem);

      const cartItemId =
        getCartItemId(
          normalizedCartItem
        );

      const latestItem =
        latestMap[cartItemId];

      if (!latestItem) {
        throw new Error(
          `${normalizedCartItem?.name || 'This item'} is no longer available. Please remove it from your cart.`
        );
      }

      const custom =
        isCustomCartItem(
          normalizedCartItem
        );

      if (custom) {
        if (
          Number(
            normalizedCartItem.quantity ||
              1
          ) !== 1
        ) {
          throw new Error(
            'Chef Oppa Special request quantity must be 1 only.'
          );
        }

        if (
          isAvailableFalse(
            latestItem?.is_available
          )
        ) {
          throw new Error(
            latestItem?.unavailable_reason ||
            latestItem?.stock_label ||
            'Chef Oppa Special is currently unavailable.'
          );
        }

        continue;
      }

      if (
        !isNormalItemOrderableByBackendStock(
          latestItem
        )
      ) {
        throw new Error(
          getStockMessage(
            latestItem
          )
        );
      }

      const latestMaxQuantity =
        getMobileMaxQuantity(
          latestItem
        );

      const requestedQuantity =
        Number(
          normalizedCartItem.quantity ||
            0
        );

      if (
        requestedQuantity <= 0
      ) {
        throw new Error(
          `${normalizedCartItem?.name || latestItem?.name || 'This item'} has invalid quantity.`
        );
      }

      if (
        latestMaxQuantity !== null &&
        requestedQuantity >
          latestMaxQuantity
      ) {
        throw new Error(
          `${normalizedCartItem?.name || latestItem?.name || 'This item'} only has ${latestMaxQuantity} order(s) available based on ingredient stock. Please reduce the quantity.`
        );
      }
    }

    return {
      valid: true,
      latestItems,
    };
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
// GET MENU
// =========================

export const getMenu = async () => {
  await clearKnownMenuCaches();

  const response =
    await fetchMenuWithFallback();

  console.log(
    'MENU FINAL API RAW:',
    response.data
  );

  console.log(
    'MENU FINAL DEBUG SOURCE:',
    getApiDebugSource(response.data)
  );

  const menuData =
    parseMenuItemsFromApiPayload(
      response.data
    );

  console.log(
    'MENU ITEMS:',
    menuData
  );

  const normalizedMenuData =
    menuData.map(
      normalizeMenuItem
    );

  console.log(
    'FIRST NORMALIZED MENU ITEM:',
    normalizedMenuData?.[0]
  );

  normalizedMenuData.forEach((item) => {
    const maxQty =
      getMobileMaxQuantity(item);

    const isAvailable =
      item.is_available === true &&
      maxQty > 0;

    console.log(
      'MENU ITEM DEBUG:',
      {
        id: item.id,
        name: item.name,
        is_available:
          item.is_available,
        max_order_quantity:
          item.max_order_quantity,
        available_quantity:
          item.available_quantity,
        remaining_today:
          item.remaining_today,
        mobile_is_available:
          isAvailable,
        mobile_max_quantity:
          maxQty,
        stock_label:
          item.stock_label,
        daily_inventory_label:
          item.daily_inventory_label,
        unavailable_reason:
          item.unavailable_reason,
        inventory_type:
          item.inventory_type,
        ingredients_count:
          item.ingredients?.length || 0,
      }
    );
  });

  return {
    success:
      getApiSuccess(response.data),
    debug_source:
      getApiDebugSource(response.data),
    data:
      normalizedMenuData,
  };
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

  await validateCartAgainstLatestMenu(
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

  try {
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
  } catch (error) {
    throw new Error(
      extractApiErrorMessage(
        error,
        'Failed to submit order.'
      )
    );
  }
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

    const recommendationData =
      parseMenuItemsFromApiPayload(
        response.data
      );

    if (
      getApiSuccess(response.data) &&
      Array.isArray(
        recommendationData
      )
    ) {
      return {
        success: true,
        debug_source:
          getApiDebugSource(response.data),
        data:
          recommendationData.map(
            normalizeMenuItem
          ),
      };
    }

    return {
      success: false,
      data: [],
      message:
        response.data?.message ||
        response.data?.data?.message ||
        'No recommendations available.',
    };
  };

export default api;