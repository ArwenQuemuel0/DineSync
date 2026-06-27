const express = require('express');

const router = express.Router();

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

// =========================
// DAILY INVENTORY SETTINGS
// =========================

const VALID_NORMAL_INVENTORY_TYPES = [
  'per_order',
  'per_head',
];

const MANILA_UTC_OFFSET_HOURS = 8;

// =========================
// REQUIRE SUPABASE
// =========================

const requireSupabase = (res) => {
  if (!isConfigured || !supabase) {
    return res.status(500).json({
      success: false,
      message:
        'Supabase is not configured. Check backend .env SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  return null;
};

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

const isCustomMenuItem = (item) => {
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

const hasDailyInventorySetup = (item) => {
  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  const dailyLimit =
    toNumberOrNull(
      item?.daily_limit
    );

  return (
    VALID_NORMAL_INVENTORY_TYPES.includes(
      inventoryType
    ) &&
    dailyLimit !== null
  );
};

// =========================
// MANILA DAY RANGE
// =========================

const getManilaTodayUtcRange = () => {
  const now =
    new Date();

  const manilaNow =
    new Date(
      now.getTime() +
        MANILA_UTC_OFFSET_HOURS *
          60 *
          60 *
          1000
    );

  const year =
    manilaNow.getUTCFullYear();

  const month =
    manilaNow.getUTCMonth();

  const date =
    manilaNow.getUTCDate();

  const startUtc =
    new Date(
      Date.UTC(
        year,
        month,
        date,
        -MANILA_UTC_OFFSET_HOURS,
        0,
        0,
        0
      )
    );

  const endUtc =
    new Date(
      startUtc.getTime() +
        24 * 60 * 60 * 1000
    );

  return {
    startIso:
      startUtc.toISOString(),

    endIso:
      endUtc.toISOString(),
  };
};

// =========================
// NORMALIZE FLAVOR TAGS
// =========================

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

  try {
    const parsed =
      JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed
        .map((tag) =>
          String(tag).trim()
        )
        .filter(Boolean);
    }
  } catch (error) {
    // Continue to comma split
  }

  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

// =========================
// NORMALIZE MEAL TYPE
// =========================

const normalizeMealType = (value) => {
  if (!value) {
    return null;
  }

  return String(value).trim();
};

// =========================
// NORMALIZE MENU ITEM
// =========================

const normalizeMenuItem = (item) => {
  return {
    ...item,

    image:
      item.image_url ||
      item.image ||
      null,

    image_url:
      item.image_url ||
      item.image ||
      null,

    inventory_type:
      item.inventory_type
        ? normalizeInventoryType(
            item.inventory_type
          )
        : null,

    daily_limit:
      toNumberOrNull(
        item.daily_limit
      ),

    sold_today:
      toNumberOrZero(
        item.sold_today
      ),

    remaining_today:
      item.remaining_today === null ||
      item.remaining_today === undefined
        ? null
        : toNumberOrZero(
            item.remaining_today
          ),

    max_order_quantity:
      toNumberOrZero(
        item.max_order_quantity
      ),

    available_quantity:
      toNumberOrZero(
        item.available_quantity
      ),

    flavor_tags:
      normalizeFlavorTags(
        item.flavor_tags
      ),

    meal_type:
      normalizeMealType(
        item.meal_type
      ),

    is_available:
      item.is_available,
  };
};

// =========================
// GET TOP BEST SELLER IDS
// =========================

const getBestSellerIds = async () => {
  const {
    data: orderItems,
    error,
  } = await supabase
    .from('order_items')
    .select('menu_item_id, quantity');

  if (error || !orderItems) {
    console.log(
      'BEST SELLER ERROR:',
      error
    );

    return [];
  }

  const salesCount = {};

  orderItems.forEach((item) => {
    const menuItemId =
      item.menu_item_id;

    const quantity =
      Number(item.quantity) || 0;

    if (!menuItemId) {
      return;
    }

    if (!salesCount[menuItemId]) {
      salesCount[menuItemId] = 0;
    }

    salesCount[menuItemId] += quantity;
  });

  return Object.entries(salesCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([menuItemId]) =>
      Number(menuItemId)
    );
};

// =========================
// GET SOLD TODAY MAP
// Uses orders created today in Asia/Manila
// =========================

const getSoldTodayMap = async () => {
  const {
    startIso,
    endIso,
  } = getManilaTodayUtcRange();

  const {
    data: orders,
    error: ordersError,
  } = await supabase
    .from('orders')
    .select('id, status, created_at')
    .gte('created_at', startIso)
    .lt('created_at', endIso);

  if (ordersError) {
    console.log(
      'SOLD TODAY ORDERS ERROR:',
      ordersError
    );

    return {};
  }

  const validOrderIds =
    (orders || [])
      .filter((order) => {
        const status =
          normalizeText(order.status);

        return ![
          'cancelled',
          'canceled',
          'failed',
          'voided',
        ].includes(status);
      })
      .map((order) => order.id)
      .filter(Boolean);

  if (validOrderIds.length === 0) {
    return {};
  }

  const {
    data: orderItems,
    error: orderItemsError,
  } = await supabase
    .from('order_items')
    .select('order_id, menu_item_id, quantity')
    .in('order_id', validOrderIds);

  if (orderItemsError) {
    console.log(
      'SOLD TODAY ORDER ITEMS ERROR:',
      orderItemsError
    );

    return {};
  }

  const soldTodayMap = {};

  (orderItems || []).forEach((item) => {
    const menuItemId =
      item.menu_item_id;

    const quantity =
      Number(item.quantity) || 0;

    if (!menuItemId) {
      return;
    }

    if (!soldTodayMap[menuItemId]) {
      soldTodayMap[menuItemId] = 0;
    }

    soldTodayMap[menuItemId] += quantity;
  });

  return soldTodayMap;
};

// =========================
// DAILY MENU INVENTORY ENRICHMENT
// IMPORTANT:
// Do not use ingredient stock here.
// Use daily_limit - sold_today.
// =========================

const enrichDailyMenuInventory = (
  menuItem,
  soldTodayMap = {}
) => {
  const custom =
    isCustomMenuItem(menuItem);

  if (custom) {
    return normalizeMenuItem({
      ...menuItem,
      price: 0,
      inventory_type: 'custom',
      daily_limit: null,
      sold_today: 0,
      remaining_today: null,
      available_quantity: 1,
      max_order_quantity: 1,
      stock_label: 'Staff confirms',
      daily_inventory_label:
        'Staff confirms',
      is_available: true,
    });
  }

  const inventoryType =
    normalizeInventoryType(
      menuItem.inventory_type
    );

  const dailyLimit =
    toNumberOrNull(
      menuItem.daily_limit
    );

  if (
    !VALID_NORMAL_INVENTORY_TYPES.includes(
      inventoryType
    ) ||
    dailyLimit === null
  ) {
    return normalizeMenuItem({
      ...menuItem,
      inventory_type:
        menuItem.inventory_type
          ? inventoryType
          : null,
      daily_limit: dailyLimit,
      sold_today: 0,
      remaining_today: null,
      available_quantity: 0,
      max_order_quantity: 0,
      stock_label: null,
      daily_inventory_label: null,
      is_available: false,
    });
  }

  const soldToday =
    Number(
      soldTodayMap[menuItem.id] || 0
    );

  const remainingToday =
    Math.max(
      0,
      dailyLimit - soldToday
    );

  const originalAvailable =
    isAvailableTrue(
      menuItem.is_available
    );

  const finalAvailable =
    originalAvailable &&
    remainingToday > 0;

  const label =
    remainingToday > 0
      ? `${remainingToday} orders left today`
      : 'Sold out today';

  return normalizeMenuItem({
    ...menuItem,

    inventory_type:
      inventoryType,

    daily_limit:
      dailyLimit,

    sold_today:
      soldToday,

    remaining_today:
      remainingToday,

    available_quantity:
      remainingToday,

    max_order_quantity:
      remainingToday,

    stock_label:
      label,

    daily_inventory_label:
      label,

    is_available:
      finalAvailable,
  });
};

// =========================
// GET ALL MENU ITEMS
// GET /api/menu
// =========================

router.get('/', async (req, res) => {
  try {
    const configError =
      requireSupabase(res);

    if (configError) {
      return;
    }

    const {
      data: menuItems,
      error: menuError,
    } = await supabase
      .from('menu_items')
      .select('*')
      .order('id', {
        ascending: true,
      });

    if (menuError) {
      return res.status(500).json({
        success: false,
        message:
          menuError.message,
      });
    }

    const [
      bestSellerIds,
      soldTodayMap,
    ] = await Promise.all([
      getBestSellerIds(),
      getSoldTodayMap(),
    ]);

    const enrichedMenuItems =
      (menuItems || []).map((item) => {
        const enrichedItem =
          enrichDailyMenuInventory(
            item,
            soldTodayMap
          );

        return normalizeMenuItem({
          ...enrichedItem,
          is_best_seller:
            bestSellerIds.includes(
              Number(item.id)
            ),
        });
      });

    return res.json({
      success: true,
      debug_source:
        'NODE_DAILY_MENU_ROUTE_UPDATED',
      data: enrichedMenuItems,
    });
  } catch (error) {
    console.log(
      'MENU ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch menu',
    });
  }
});

// =========================
// GET TOP 3 BEST SELLERS
// GET /api/menu/best-sellers
// =========================

router.get(
  '/best-sellers',
  async (req, res) => {
    try {
      const configError =
        requireSupabase(res);

      if (configError) {
        return;
      }

      const bestSellerIds =
        await getBestSellerIds();

      if (
        !bestSellerIds ||
        bestSellerIds.length === 0
      ) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const {
        data: menuItems,
        error,
      } = await supabase
        .from('menu_items')
        .select('*')
        .in(
          'id',
          bestSellerIds
        );

      if (error) {
        return res.status(500).json({
          success: false,
          message:
            error.message,
        });
      }

      const soldTodayMap =
        await getSoldTodayMap();

      const sortedMenuItems =
        bestSellerIds
          .map((id) =>
            (menuItems || []).find(
              (item) =>
                Number(item.id) ===
                Number(id)
            )
          )
          .filter(Boolean);

      const enrichedMenuItems =
        sortedMenuItems.map((item) => {
          const enrichedItem =
            enrichDailyMenuInventory(
              item,
              soldTodayMap
            );

          return normalizeMenuItem({
            ...enrichedItem,
            is_best_seller: true,
          });
        });

      return res.json({
        success: true,
        data: enrichedMenuItems,
      });
    } catch (error) {
      console.log(
        'BEST SELLERS ROUTE ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to fetch best sellers',
      });
    }
  }
);

// =========================
// GET MENU ITEMS BY CATEGORY
// GET /api/menu/category/:category
// =========================

router.get(
  '/category/:category',
  async (req, res) => {
    try {
      const configError =
        requireSupabase(res);

      if (configError) {
        return;
      }

      const category =
        req.params.category;

      const {
        data: menuItems,
        error,
      } = await supabase
        .from('menu_items')
        .select('*')
        .eq(
          'category',
          category
        )
        .order('id', {
          ascending: true,
        });

      if (error) {
        return res.status(500).json({
          success: false,
          message:
            error.message,
        });
      }

      const [
        bestSellerIds,
        soldTodayMap,
      ] = await Promise.all([
        getBestSellerIds(),
        getSoldTodayMap(),
      ]);

      const enrichedMenuItems =
        (menuItems || []).map((item) => {
          const enrichedItem =
            enrichDailyMenuInventory(
              item,
              soldTodayMap
            );

          return normalizeMenuItem({
            ...enrichedItem,
            is_best_seller:
              bestSellerIds.includes(
                Number(item.id)
              ),
          });
        });

      return res.json({
        success: true,
        data: enrichedMenuItems,
      });
    } catch (error) {
      console.log(
        'CATEGORY MENU ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to fetch category menu',
      });
    }
  }
);

module.exports = router;