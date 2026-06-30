const express = require('express');
const axios = require('axios');

const router = express.Router();

const db = require('../mockDb');

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

const {
  TABLE_ASSIGNMENT_MESSAGE,
  normalizeTableStatus,
} = require('../utils/tableStatus');

const { createInvoice } = require('../utils/xendit');

// =========================
// DEFAULT IPAD TABLE
// =========================

const DEFAULT_TABLE_NUMBER = 1;

// =========================
// FIXED MENU INVENTORY API
// =========================

const FIXED_MENU_URL =
  process.env.LARAVEL_MENU_URL ||
  process.env.FIXED_MENU_URL ||
  'https://dinesync.shop/api/menu';

const EXPECTED_MENU_DEBUG_SOURCE =
  'WEB_MENU_INGREDIENT_AVAILABILITY_FIXED_2026';

// =========================
// BASIC HELPERS
// =========================

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase();
};

const normalizeInventoryType = (value) => {
  return normalizeText(value)
    .replace(/[-\s]+/g, '_');
};

const toNumberOrNull = (value) => {
  if (
    value === null ||
    value === undefined ||
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

const isChefOppaSpecialItem = (item) => {
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

const getOrderItemMenuId = (item) => {
  return Number(
    item?.menu_item_id ||
    item?.id ||
    0
  );
};

const getMenuItemId = (item) => {
  return Number(
    item?.menu_item_id ||
    item?.id ||
    0
  );
};

const getMenuMaxQuantity = (item) => {
  if (!item) {
    return 0;
  }

  if (isChefOppaSpecialItem(item)) {
    return 1;
  }

  const maxQty =
    toNumberOrNull(
      item?.max_order_quantity ??
      item?.available_quantity ??
      item?.remaining_today
    );

  if (maxQty === null) {
    return 0;
  }

  return Math.max(0, maxQty);
};

const getMenuStockMessage = (item) => {
  if (!item) {
    return 'This item is currently unavailable.';
  }

  const maxQty =
    getMenuMaxQuantity(item);

  const isAvailable =
    item?.is_available === true &&
    maxQty > 0;

  if (isAvailable) {
    return (
      item?.stock_label ||
      item?.daily_inventory_label ||
      `Only ${maxQty} order(s) available based on ingredient stock.`
    );
  }

  return (
    item?.unavailable_reason ||
    item?.stock_label ||
    item?.daily_inventory_label ||
    `${item?.name || 'This item'} is currently unavailable.`
  );
};

const normalizeMenuAvailabilityItem = (item) => {
  const maxQty =
    getMenuMaxQuantity(item);

  const isAvailable =
    isChefOppaSpecialItem(item)
      ? !isAvailableFalse(item?.is_available)
      : isAvailableTrue(item?.is_available) &&
        maxQty > 0;

  return {
    ...item,

    id:
      item?.id ??
      item?.menu_item_id,

    menu_item_id:
      item?.menu_item_id ??
      item?.id,

    name:
      item?.name || 'Menu Item',

    category:
      item?.category || '',

    price:
      Number(item?.price || 0),

    is_available:
      isAvailable,

    max_order_quantity:
      isAvailable ? maxQty : 0,

    available_quantity:
      isAvailable ? maxQty : 0,

    remaining_today:
      isAvailable ? maxQty : 0,

    stock_label:
      item?.stock_label ||
      item?.daily_inventory_label ||
      null,

    daily_inventory_label:
      item?.daily_inventory_label ||
      item?.stock_label ||
      null,

    unavailable_reason:
      isAvailable
        ? null
        : (
            item?.unavailable_reason ||
            item?.stock_label ||
            item?.daily_inventory_label ||
            'Unavailable based on ingredient stock.'
          ),

    inventory_type:
      normalizeInventoryType(
        item?.inventory_type ||
        'ingredient'
      ),
  };
};

const extractMenuItemsFromPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    payload &&
    Array.isArray(payload.data)
  ) {
    return payload.data;
  }

  if (
    payload &&
    payload.data &&
    Array.isArray(payload.data.data)
  ) {
    return payload.data.data;
  }

  if (
    payload &&
    payload.data &&
    payload.data.data &&
    Array.isArray(payload.data.data.data)
  ) {
    return payload.data.data.data;
  }

  return [];
};

const getMenuDebugSourceFromPayload = (payload) => {
  return (
    payload?.debug_source ||
    payload?.data?.debug_source ||
    payload?.data?.data?.debug_source ||
    null
  );
};

const fetchFixedMenuInventory = async () => {
  const response =
    await axios.get(
      FIXED_MENU_URL,
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

  const debugSource =
    getMenuDebugSourceFromPayload(
      response.data
    );

  const rawItems =
    extractMenuItemsFromPayload(
      response.data
    );

  console.log(
    'ORDER INVENTORY MENU DEBUG SOURCE:',
    debugSource
  );

  console.log(
    'ORDER INVENTORY MENU ITEMS COUNT:',
    rawItems.length
  );

  return {
    debugSource,
    items:
      rawItems.map(
        normalizeMenuAvailabilityItem
      ),
  };
};

// =========================
// DATE / TIME HELPERS
// IMPORTANT:
// Backend stores UTC.
// Mobile displays using Asia/Manila.
// =========================

const getUtcNowIso = () => {
  return new Date().toISOString();
};

const normalizeUtcIsoDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString();
  }

  const stringValue =
    String(value).trim();

  if (!stringValue) {
    return null;
  }

  const hasTimezone =
    /z$/i.test(stringValue) ||
    /[+-]\d{2}:\d{2}$/.test(stringValue);

  const safeValue =
    hasTimezone
      ? stringValue
      : `${stringValue}Z`;

  const date =
    new Date(safeValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return stringValue;
  }

  return date.toISOString();
};

const normalizeOrderDateFields = (order) => {
  if (!order) {
    return order;
  }

  return {
    ...order,
    created_at:
      normalizeUtcIsoDate(
        order.created_at
      ),
    updated_at:
      normalizeUtcIsoDate(
        order.updated_at
      ),
    paid_at:
      normalizeUtcIsoDate(
        order.paid_at
      ),
    xendit_expiry_date:
      normalizeUtcIsoDate(
        order.xendit_expiry_date
      ),
  };
};

// =========================
// PAYMENT METHOD HELPERS
// =========================

const normalizePaymentMethod = (value) => {
  const normalized =
    String(value || '')
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
    normalized === 'pay later' ||
    normalized === 'later'
  ) {
    return 'Pay Later';
  }

  if (
    normalized === 'pay at counter' ||
    normalized === 'pay counter' ||
    normalized === 'counter' ||
    normalized === 'cashier'
  ) {
    return 'Pay at Counter';
  }

  if (normalized === 'cash') {
    return 'Cash';
  }

  return 'Pay Later';
};

const hasXenditInvoice = (order) => {
  return Boolean(
    order?.xendit_invoice_id ||
    order?.xendit_external_id ||
    order?.xendit_invoice_url
  );
};

const forceDigitalPaymentIfXendit = (order) => {
  if (!order) {
    return order;
  }

  const normalizedOrder =
    normalizeOrderDateFields(order);

  if (hasXenditInvoice(normalizedOrder)) {
    return {
      ...normalizedOrder,
      payment_method: 'Digital Payment',
    };
  }

  return normalizedOrder;
};

const shouldCreateXenditInvoice = (paymentMethod) => {
  return paymentMethod === 'Digital Payment';
};

const getInitialOrderStatus = (paymentMethod) => {
  if (paymentMethod === 'Pay Later') {
    return 'pending';
  }

  if (
    paymentMethod === 'Pay at Counter' ||
    paymentMethod === 'Digital Payment'
  ) {
    return 'awaiting_payment';
  }

  return 'pending';
};

const buildMockExternalId = (orderId) => {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(now.getMonth() + 1)
      .padStart(2, '0');

  const day =
    String(now.getDate())
      .padStart(2, '0');

  const hour =
    String(now.getHours())
      .padStart(2, '0');

  const minute =
    String(now.getMinutes())
      .padStart(2, '0');

  return `ORDER-${orderId}-${year}${month}${day}${hour}${minute}`;
};

// =========================
// GET TABLE NUMBER FROM TOKEN
// Token format: Bearer table-token-1
// =========================

const getTableNumberFromToken = (req) => {
  const authHeader =
    req.headers.authorization || '';

  const token =
    authHeader.replace(
      'Bearer ',
      ''
    );

  if (
    token &&
    token.startsWith('table-token-')
  ) {
    const tableNumber =
      Number(
        token.replace(
          'table-token-',
          ''
        )
      );

    if (tableNumber) {
      return tableNumber;
    }
  }

  return null;
};

// =========================
// INGREDIENT-BASED MENU VALIDATION
// NO DAILY MENU INVENTORY VALIDATION HERE
// =========================

const validateMenuAvailabilityItems = async (
  items = []
) => {
  let menuResult;

  try {
    menuResult =
      await fetchFixedMenuInventory();
  } catch (error) {
    console.log(
      'FIXED MENU INVENTORY FETCH ERROR:',
      error?.response?.data ||
      error?.message ||
      error
    );

    return {
      valid: false,
      status: 500,
      message:
        'Unable to verify ingredient-based inventory. Please try again.',
    };
  }

  if (
    menuResult.debugSource &&
    menuResult.debugSource !==
      EXPECTED_MENU_DEBUG_SOURCE
  ) {
    console.log(
      'WARNING: MENU DEBUG SOURCE IS NOT EXPECTED:',
      menuResult.debugSource
    );
  }

  const menuMap = {};

  menuResult.items.forEach((menuItem) => {
    const id =
      getMenuItemId(menuItem);

    if (id) {
      menuMap[id] = menuItem;
    }
  });

  for (const item of items) {
    const menuItemId =
      getOrderItemMenuId(item);

    const orderedQty =
      Number(item.quantity);

    if (
      !menuItemId ||
      !orderedQty ||
      orderedQty <= 0
    ) {
      return {
        valid: false,
        status: 400,
        message:
          'Invalid order item quantity.',
      };
    }

    const latestMenuItem =
      menuMap[menuItemId];

    if (!latestMenuItem) {
      return {
        valid: false,
        status: 404,
        message:
          'Menu item not found or no longer available.',
      };
    }

    const isCustom =
      isChefOppaSpecialItem(
        latestMenuItem
      );

    if (isCustom) {
      if (orderedQty !== 1) {
        return {
          valid: false,
          status: 422,
          message:
            'Chef Oppa Special request quantity must be 1 only.',
        };
      }

      if (
        isAvailableFalse(
          latestMenuItem.is_available
        )
      ) {
        return {
          valid: false,
          status: 422,
          message:
            latestMenuItem.unavailable_reason ||
            latestMenuItem.stock_label ||
            'Chef Oppa Special is currently unavailable.',
        };
      }

      continue;
    }

    const maxQty =
      getMenuMaxQuantity(
        latestMenuItem
      );

    const isAvailable =
      latestMenuItem.is_available === true &&
      maxQty > 0;

    if (!isAvailable) {
      return {
        valid: false,
        status: 422,
        message:
          getMenuStockMessage(
            latestMenuItem
          ),
      };
    }

    if (orderedQty > maxQty) {
      return {
        valid: false,
        status: 422,
        message:
          `${latestMenuItem.name} only has ${maxQty} order(s) available based on ingredient stock. Please reduce the quantity.`,
      };
    }
  }

  return {
    valid: true,
    status: 200,
    message: '',
  };
};

// =========================
// GET BEST SELLER IDS
// =========================

const getBestSellerIds = async () => {
  if (!isConfigured) {
    return [];
  }

  const {
    data,
    error,
  } = await supabase
    .from('order_items')
    .select(`
      menu_item_id,
      quantity,
      menu_items (
        id,
        name,
        price,
        category,
        image
      )
    `);

  if (error) {
    console.log(
      'BEST SELLERS ERROR:',
      error
    );

    return [];
  }

  const salesMap = {};

  for (const row of data || []) {
    const item = row.menu_items;

    if (!item) {
      continue;
    }

    const itemId = item.id;

    if (!salesMap[itemId]) {
      salesMap[itemId] = {
        ...item,
        total_sales: 0,
      };
    }

    salesMap[itemId].total_sales +=
      Number(row.quantity || 0);
  }

  return Object.values(salesMap)
    .sort(
      (a, b) =>
        b.total_sales -
        a.total_sales
    )
    .slice(0, 3);
};

// =========================
// BEST SELLERS
// =========================

router.get(
  '/best-sellers/list',
  async (req, res) => {
    try {
      const bestSellers =
        await getBestSellerIds();

      return res.json({
        success: true,
        data: bestSellers,
      });
    } catch (error) {
      console.log(
        'BEST SELLERS ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  }
);

// =========================
// GET ACTIVE ORDERS BY TABLE
// GET /api/orders/table/:tableNumber/active
// =========================

router.get(
  '/table/:tableNumber/active',
  async (req, res) => {
    try {
      const tableNumber =
        Number(req.params.tableNumber);

      if (!tableNumber) {
        return res.status(400).json({
          success: false,
          message:
            'Table number is required.',
        });
      }

      if (!isConfigured) {
        const activeOrders =
          db.orders
            .filter((order) => {
              const status =
                String(order.status || '')
                  .toLowerCase();

              return (
                Number(order.table_number) ===
                tableNumber &&
                [
                  'pending',
                  'preparing',
                  'ready',
                    'served',
  'completed',
                ].includes(status)
              );
            })
            .map(forceDigitalPaymentIfXendit);

        return res.json({
          success: true,
          data: activeOrders,
        });
      }

      const {
        data: restaurantTable,
        error: tableError,
      } = await supabase
        .from('restaurant_tables')
        .select('id')
        .eq(
          'table_number',
          tableNumber
        )
        .single();

      if (
        tableError ||
        !restaurantTable
      ) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const {
        data: activeSessions,
        error: sessionError,
      } = await supabase
        .from('table_sessions')
        .select('id')
        .eq(
          'restaurant_table_id',
          restaurantTable.id
        )
        .eq('status', 'active')
        .order('created_at', {
          ascending: false,
        })
        .limit(1);

      if (
        sessionError ||
        !activeSessions ||
        activeSessions.length === 0
      ) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const activeSessionId =
        activeSessions[0].id;

      const {
        data: orders,
        error: ordersError,
      } = await supabase
        .from('orders')
        .select(
          'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date, paid_at'
        )
        .eq(
          'table_session_id',
          activeSessionId
        )
        .in('status', [
  'pending',
  'preparing',
  'ready',
  'served',
  'completed',
  'Pending',
  'Preparing',
  'Ready',
  'Served',
  'Completed',
])
        .order('created_at', {
          ascending: false,
        });

      if (ordersError) {
        throw ordersError;
      }

      const normalizedOrders =
        (orders || []).map(
          forceDigitalPaymentIfXendit
        );

      const orderIds =
        normalizedOrders.map(
          (order) => order.id
        );

      if (orderIds.length === 0) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const {
        data: orderItems,
        error: itemsError,
      } = await supabase
        .from('order_items')
        .select('*')
        .in(
          'order_id',
          orderIds
        );

      if (itemsError) {
        throw itemsError;
      }

      const menuItemIds = [
        ...new Set(
          (orderItems || [])
            .map(
              (item) =>
                item.menu_item_id
            )
            .filter(Boolean)
        ),
      ];

      let menuItems = [];

      if (menuItemIds.length > 0) {
        const {
          data: menuData,
          error: menuError,
        } = await supabase
          .from('menu_items')
          .select(
            'id, name, price, category, image'
          )
          .in(
            'id',
            menuItemIds
          );

        if (menuError) {
          throw menuError;
        }

        menuItems =
          menuData || [];
      }

      const enrichedOrders =
        normalizedOrders.map((order) => {
          const items =
            (orderItems || [])
              .filter(
                (item) =>
                  Number(item.order_id) ===
                  Number(order.id)
              )
              .map((item) => {
                const menuItem =
                  menuItems.find(
                    (menu) =>
                      Number(menu.id) ===
                      Number(
                        item.menu_item_id
                      )
                  );

                const price =
                  Number(
                    item.price ||
                    menuItem?.price ||
                    0
                  );

                const quantity =
                  Number(
                    item.quantity || 0
                  );

                return {
                  ...item,
                  name:
                    item.name ||
                    menuItem?.name ||
                    'Menu Item',
                  price,
                  quantity,
                  subtotal:
                    price * quantity,
                  menu_item:
                    menuItem || null,
                };
              });

          return {
            ...order,
            items,
          };
        });

      return res.json({
        success: true,
        data: enrichedOrders,
      });
    } catch (error) {
      console.log(
        'GET ACTIVE TABLE ORDERS ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to fetch active table orders.',
      });
    }
  }
);

// =========================
// CREATE ORDER
// POST /api/orders
// =========================

router.post('/', async (req, res) => {
  try {
    const {
      items,
      table_number,
      tableNumber,
    } = req.body;

    const tokenTableNumber =
      getTableNumberFromToken(req);

    const finalTableNumber =
      Number(
        table_number ||
        tableNumber ||
        tokenTableNumber ||
        DEFAULT_TABLE_NUMBER
      );

    const paymentMethod =
      normalizePaymentMethod(
        req.body.payment_method ||
        req.body.paymentMethod
      );

    const needInvoice =
      shouldCreateXenditInvoice(
        paymentMethod
      );

    const newOrderStatus =
      getInitialOrderStatus(
        paymentMethod
      );

    console.log(
      'REQ BODY:',
      JSON.stringify(req.body, null, 2)
    );

    console.log(
      'TABLE NUMBER:',
      finalTableNumber
    );

    console.log(
      'PAYMENT METHOD:',
      paymentMethod
    );

    console.log(
      'INITIAL ORDER STATUS:',
      newOrderStatus
    );

    console.log(
      'NEED XENDIT INVOICE:',
      needInvoice
    );

    console.log(
      'ITEMS:',
      JSON.stringify(items, null, 2)
    );

    if (!finalTableNumber) {
      return res.status(400).json({
        success: false,
        message:
          'Table number is required.',
      });
    }

    if (
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Order must contain items.',
      });
    }

    const totalAmount =
      items.reduce(
        (sum, item) => {
          const price =
            Number(item.price || 0);

          const quantity =
            Number(item.quantity || 0);

          return sum + price * quantity;
        },
        0
      );

    if (totalAmount < 0) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid order total amount.',
      });
    }

    if (
      totalAmount <= 0 &&
      !items.some((item) => {
        const notes =
          String(
            item.special_request ||
            item.notes ||
            ''
          ).trim();

        return notes.length > 0;
      })
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid order total amount.',
      });
    }

    if (!isConfigured) {
      const mockOrderId =
        db.orders.length + 1;

      const invoiceData = needInvoice
        ? {
          xendit_invoice_id:
            `mock_inv_${Math.random()
              .toString(36)
              .substring(2, 11)
              .toUpperCase()}`,
          xendit_external_id:
            buildMockExternalId(
              mockOrderId
            ),
          xendit_invoice_url:
            `https://checkout-staging.xendit.co/web/mock_inv_${Date.now()}`,
          xendit_expiry_date:
            getUtcNowIso(),
        }
        : {
          xendit_invoice_id:
            null,
          xendit_external_id:
            null,
          xendit_invoice_url:
            null,
          xendit_expiry_date:
            null,
        };

      const now =
        getUtcNowIso();

      const newOrder =
        normalizeOrderDateFields({
          id: mockOrderId,
          order_number:
            `ORD-${Date.now()}`,
          table_number:
            finalTableNumber,
          table_session_id:
            null,
          items,
          total_amount:
            totalAmount,
          status:
            needInvoice
              ? 'awaiting_payment'
              : newOrderStatus,
          payment_method:
            needInvoice
              ? 'Digital Payment'
              : paymentMethod,
          payment_status:
            'pending',
          paid_at:
            null,
          created_at:
            now,
          updated_at:
            now,
          ...invoiceData,
        });

      db.orders.push(newOrder);

      return res.status(201).json({
        success: true,
        message:
          'Order created successfully.',
        data:
          newOrder,
        order_id:
          newOrder.id,
        payment_status:
          newOrder.payment_status,
        payment_method:
          newOrder.payment_method,
        order_status:
          newOrder.status,
        invoice_url:
          newOrder.xendit_invoice_url,
        xendit_invoice_url:
          newOrder.xendit_invoice_url,
      });
    }

    const {
      data: restaurantTable,
      error: tableError,
    } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq(
        'table_number',
        finalTableNumber
      )
      .single();

    if (
      tableError ||
      !restaurantTable
    ) {
      console.log(
        'RESTAURANT TABLE ERROR:',
        tableError
      );

      return res.status(404).json({
        success: false,
        message:
          `Table No. ${finalTableNumber} was not found in restaurant_tables.`,
      });
    }

    const tableStatus =
      normalizeTableStatus(
        restaurantTable.status
      );

    const {
      data: activeSession,
      error: sessionError,
    } = await supabase
      .from('table_sessions')
      .select('*')
      .eq(
        'restaurant_table_id',
        restaurantTable.id
      )
      .eq('status', 'active')
      .single();

    if (
      tableStatus !== 'occupied' ||
      sessionError ||
      !activeSession
    ) {
      console.log(
        'TABLE ASSIGNMENT ERROR:',
        sessionError
      );

      return res.status(403).json({
        success: false,
        message:
          TABLE_ASSIGNMENT_MESSAGE,
      });
    }

    const inventoryValidation =
      await validateMenuAvailabilityItems(
        items
      );

    if (!inventoryValidation.valid) {
      return res
        .status(
          inventoryValidation.status ||
          422
        )
        .json({
          success: false,
          message:
            inventoryValidation.message,
        });
    }

    const orderNumber =
      `ORD-${Date.now()}`;

    const now =
      getUtcNowIso();

    const orderPayload = {
      order_number:
        orderNumber,
      table_number:
        finalTableNumber,
      table_session_id:
        activeSession.id,
      total_amount:
        totalAmount,
      status:
        needInvoice
          ? 'awaiting_payment'
          : newOrderStatus,
      payment_method:
        needInvoice
          ? 'Digital Payment'
          : paymentMethod,
      payment_status:
        'pending',
      paid_at:
        null,
      created_at:
        now,
      updated_at:
        now,
    };

    const {
      data: createdOrder,
      error: orderError,
    } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select(
        'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, paid_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
      )
      .single();

    if (
      orderError ||
      !createdOrder
    ) {
      console.log(
        'ORDER INSERT ERROR:',
        orderError
      );

      return res.status(500).json({
        success: false,
        message:
          orderError?.message ||
          'Failed to create order.',
      });
    }

    const orderId =
      createdOrder.id;

    const orderItemsPayload =
      items.map((item) => ({
        order_id:
          orderId,
        menu_item_id:
          item.menu_item_id ||
          item.id,
        quantity:
          Number(item.quantity),
        price:
          Number(item.price) || 0,
      }));

    console.log(
      'ORDER ITEMS PAYLOAD:',
      JSON.stringify(
        orderItemsPayload,
        null,
        2
      )
    );

    const {
      error: orderItemsError,
    } = await supabase
      .from('order_items')
      .insert(orderItemsPayload);

    if (orderItemsError) {
      console.log(
        'ORDER ITEMS ERROR:',
        orderItemsError
      );

      return res.status(500).json({
        success: false,
        message:
          orderItemsError.message,
      });
    }

    const {
      error: tableUpdateError,
    } = await supabase
      .from('restaurant_tables')
      .update({
        current_order_id:
          orderId,
        notes:
          'Tablet order',
        updated_at:
          getUtcNowIso(),
      })
      .eq(
        'table_number',
        finalTableNumber
      );

    if (tableUpdateError) {
      console.log(
        'TABLE UPDATE ERROR:',
        tableUpdateError
      );

      return res.status(500).json({
        success: false,
        message:
          tableUpdateError.message ||
          'Order created but failed to update table assignment.',
      });
    }

    if (needInvoice) {
      try {
        const invoice =
          await createInvoice(
            orderId,
            totalAmount,
            finalTableNumber
          );

        const invoiceUpdatePayload = {
          payment_method:
            'Digital Payment',
          payment_status:
            'pending',
          status:
            'awaiting_payment',
          xendit_invoice_id:
            invoice.id,
          xendit_external_id:
            invoice.external_id,
          xendit_invoice_url:
            invoice.invoice_url,
          updated_at:
            getUtcNowIso(),
        };

        if (invoice.expiry_date) {
          invoiceUpdatePayload.xendit_expiry_date =
            invoice.expiry_date;
        }

        const {
          data: updatedInvoiceOrder,
          error: updateOrderError,
        } = await supabase
          .from('orders')
          .update(invoiceUpdatePayload)
          .eq('id', orderId)
          .select(
            'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, paid_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
          )
          .single();

        if (updateOrderError) {
          console.log(
            'XENDIT ORDER UPDATE ERROR:',
            updateOrderError
          );

          return res.status(500).json({
            success: false,
            message:
              updateOrderError.message ||
              'Invoice created but failed to save invoice details.',
          });
        }

        createdOrder.payment_method =
          'Digital Payment';

        createdOrder.payment_status =
          updatedInvoiceOrder.payment_status;

        createdOrder.status =
          updatedInvoiceOrder.status;

        createdOrder.xendit_invoice_id =
          updatedInvoiceOrder.xendit_invoice_id;

        createdOrder.xendit_external_id =
          updatedInvoiceOrder.xendit_external_id;

        createdOrder.xendit_invoice_url =
          updatedInvoiceOrder.xendit_invoice_url;

        createdOrder.xendit_expiry_date =
          updatedInvoiceOrder.xendit_expiry_date;

        createdOrder.updated_at =
          updatedInvoiceOrder.updated_at;

        console.log(
          'XENDIT DETAILS SAVED TO ORDER:',
          {
            order_id:
              orderId,
            payment_method:
              createdOrder.payment_method,
            xendit_invoice_id:
              updatedInvoiceOrder.xendit_invoice_id,
            xendit_external_id:
              updatedInvoiceOrder.xendit_external_id,
            xendit_invoice_url:
              updatedInvoiceOrder.xendit_invoice_url,
          }
        );
      } catch (invoiceError) {
        console.log(
          'XENDIT INVOICE CREATION ERROR:',
          invoiceError.response?.data ||
          invoiceError.message ||
          invoiceError
        );

        return res.status(500).json({
          success: false,
          message:
            'Failed to initiate QR PH payment.',
          error:
            invoiceError.response?.data ||
            invoiceError.message ||
            String(invoiceError),
        });
      }
    }

    const fixedCreatedOrder =
      forceDigitalPaymentIfXendit(
        createdOrder
      );

    return res.status(201).json({
      success: true,
      message:
        'Order created successfully.',
      data: {
        ...fixedCreatedOrder,
        items:
          orderItemsPayload,
        restaurant_table:
          restaurantTable,
        table_session:
          activeSession,
      },
      order_id:
        fixedCreatedOrder.id,
      payment_status:
        fixedCreatedOrder.payment_status,
      payment_method:
        fixedCreatedOrder.payment_method,
      order_status:
        fixedCreatedOrder.status,
      invoice_url:
        fixedCreatedOrder.xendit_invoice_url,
      xendit_invoice_url:
        fixedCreatedOrder.xendit_invoice_url,
      xendit_invoice_id:
        fixedCreatedOrder.xendit_invoice_id,
      xendit_external_id:
        fixedCreatedOrder.xendit_external_id,
      xendit_expiry_date:
        fixedCreatedOrder.xendit_expiry_date,
    });
  } catch (error) {
    console.error(
      'CREATE ORDER SERVER ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Server Error',
    });
  }
});

// =========================
// GET ORDER BY ID
// GET /api/orders/:id
// =========================

router.get('/:id', async (req, res) => {
  try {
    const orderId =
      parseInt(req.params.id);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid order id.',
      });
    }

    if (!isConfigured) {
      const order =
        db.orders.find(
          (o) =>
            Number(o.id) ===
            Number(orderId)
        );

      if (order) {
        return res.json({
          success: true,
          data:
            forceDigitalPaymentIfXendit(
              order
            ),
        });
      }

      return res.status(404).json({
        success: false,
        message:
          'Not found',
      });
    }

    const {
      data: orderRow,
      error: orderError,
    } = await supabase
      .from('orders')
      .select(
        'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, paid_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
      )
      .eq(
        'id',
        orderId
      )
      .single();

    if (
      orderError ||
      !orderRow
    ) {
      return res.status(404).json({
        success: false,
        message:
          'Not found',
      });
    }

    let fixedOrderRow =
      forceDigitalPaymentIfXendit(
        orderRow
      );
      if (
  fixedOrderRow?.xendit_invoice_id &&
  fixedOrderRow?.payment_status === 'pending'
) {
  try {
    const xenditResponse = await axios.get(
      `https://api.xendit.co/v2/invoices/${fixedOrderRow.xendit_invoice_id}`,
      {
        auth: {
          username: process.env.XENDIT_SECRET_KEY,
          password: '',
        },
      }
    );

    const xenditStatus = String(
      xenditResponse.data?.status || ''
    ).toUpperCase();

    if (
      xenditStatus === 'PAID' ||
      xenditStatus === 'SETTLED'
    ) {
      const {
        data: paidOrder,
        error: paidUpdateError,
      } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'pending',
          paid_at: getUtcNowIso(),
          updated_at: getUtcNowIso(),
        })
        .eq('id', orderId)
        .select(
          'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, paid_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
        )
        .single();

      if (!paidUpdateError && paidOrder) {
        fixedOrderRow =
          forceDigitalPaymentIfXendit(
            paidOrder
          );
      }
    }
  } catch (xenditCheckError) {
    console.log(
      'XENDIT STATUS CHECK WARNING:',
      xenditCheckError?.response?.data ||
        xenditCheckError?.message ||
        xenditCheckError
    );
  }
}

    if (
      hasXenditInvoice(orderRow) &&
      orderRow.payment_method !==
      'Digital Payment'
    ) {
      const {
        data: correctedOrder,
        error: correctionError,
      } = await supabase
        .from('orders')
        .update({
          payment_method:
            'Digital Payment',
          updated_at:
            getUtcNowIso(),
        })
        .eq(
          'id',
          orderId
        )
        .select(
          'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, paid_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
        )
        .single();

      if (
        !correctionError &&
        correctedOrder
      ) {
        fixedOrderRow =
          forceDigitalPaymentIfXendit(
            correctedOrder
          );
      }
    }

    const {
      data: orderItems,
      error: itemsError,
    } = await supabase
      .from('order_items')
      .select('*')
      .eq(
        'order_id',
        orderId
      );

    if (itemsError) {
      throw itemsError;
    }

    const menuItemIds = [
      ...new Set(
        (orderItems || [])
          .map(
            (item) =>
              item.menu_item_id
          )
          .filter(Boolean)
      ),
    ];

    let menuItems = [];

    if (menuItemIds.length > 0) {
      const {
        data: menuData,
        error: menuError,
      } = await supabase
        .from('menu_items')
        .select(
          'id, name, price, category, image'
        )
        .in(
          'id',
          menuItemIds
        );

      if (menuError) {
        throw menuError;
      }

      menuItems =
        menuData || [];
    }

    const enrichedItems =
      (orderItems || []).map(
        (item) => {
          const menuItem =
            menuItems.find(
              (menu) =>
                Number(menu.id) ===
                Number(
                  item.menu_item_id
                )
            );

          const price =
            Number(
              item.price ||
              menuItem?.price ||
              0
            );

          const quantity =
            Number(
              item.quantity || 0
            );

          return {
            ...item,
            name:
              item.name ||
              menuItem?.name ||
              'Menu Item',
            price,
            quantity,
            subtotal:
              price * quantity,
            menu_item:
              menuItem || null,
          };
        }
      );

    return res.json({
      success: true,
      data: {
        ...fixedOrderRow,
        items:
          enrichedItems,
      },
      order_id:
        fixedOrderRow.id,
      payment_status:
        fixedOrderRow.payment_status,
      payment_method:
        fixedOrderRow.payment_method,
      order_status:
        fixedOrderRow.status,
      invoice_url:
        fixedOrderRow.xendit_invoice_url,
      xendit_invoice_url:
        fixedOrderRow.xendit_invoice_url,
      xendit_invoice_id:
        fixedOrderRow.xendit_invoice_id,
      xendit_external_id:
        fixedOrderRow.xendit_external_id,
      xendit_expiry_date:
        fixedOrderRow.xendit_expiry_date,
    });
  } catch (error) {
    console.log(
      'GET ORDER BY ID ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch order.',
    });
  }
});

module.exports = router;