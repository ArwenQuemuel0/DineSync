const express = require('express');

const router = express.Router();

// =========================
// FIXED INGREDIENT MENU SOURCE
// =========================

const WEB_MENU_URL =
  process.env.WEB_MENU_URL ||
  process.env.LARAVEL_MENU_URL ||
  'https://dinesync.shop/api/menu';

const EXPECTED_DEBUG_SOURCE =
  'WEB_MENU_INGREDIENT_AVAILABILITY_FIXED_2026';

// =========================
// BASIC HELPERS
// =========================

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase();
};

const toNumber = (value) => {
  const numberValue =
    Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
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

const normalizeMealType = (value) => {
  if (!value) {
    return null;
  }

  return String(value).trim();
};

const isCustomMenuItem = (item) => {
  const category =
    normalizeText(item?.category);

  const inventoryType =
    normalizeText(item?.inventory_type)
      .replace(/[-\s]+/g, '_');

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

const getMaxOrderQuantity = (item) => {
  if (isCustomMenuItem(item)) {
    return 1;
  }

  return Math.max(
    0,
    toNumber(
      item?.max_order_quantity ??
      item?.remaining_today ??
      item?.available_quantity ??
      0
    )
  );
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

const getDebugSourceFromPayload = (payload) => {
  return (
    payload?.debug_source ||
    payload?.data?.debug_source ||
    payload?.data?.data?.debug_source ||
    null
  );
};

const getItemImage = (item) => {
  return (
    item?.image_url ||
    item?.image ||
    null
  );
};

const normalizeMenuItem = (item) => {
  const customItem =
    isCustomMenuItem(item);

  const maxQty =
    getMaxOrderQuantity(item);

  const available =
    customItem
      ? isAvailableTrue(item?.is_available)
      : isAvailableTrue(item?.is_available) &&
        maxQty > 0;

  const image =
    getItemImage(item);

  const unavailableReason =
    item?.unavailable_reason ||
    item?.stock_label ||
    'Unavailable based on ingredient stock.';

  const stockLabel =
    customItem
      ? 'Staff confirms'
      : item?.stock_label ||
        (
          available
            ? `${maxQty} order(s) available`
            : unavailableReason
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
      item?.name || 'Menu Item',

    category:
      item?.category || 'Uncategorized',

    description:
      item?.description || '',

    price:
      Number(item?.price || 0),

    image,
    image_url: image,

    flavor_tags:
      normalizeFlavorTags(
        item?.flavor_tags
      ),

    meal_type:
      normalizeMealType(
        item?.meal_type
      ),

    is_best_seller:
      item?.is_best_seller === true ||
      item?.is_best_seller === 1 ||
      item?.is_best_seller === '1' ||
      normalizeText(item?.is_best_seller) === 'true',

    inventory_type:
      customItem
        ? 'custom'
        : 'ingredient',

    is_available:
      available,

    max_order_quantity:
      available ? maxQty : 0,

    available_quantity:
      available ? maxQty : 0,

    remaining_today:
      available ? maxQty : 0,

    stock_label:
      stockLabel,

    unavailable_reason:
      available
        ? null
        : unavailableReason,
  };
};

const fetchWebIngredientMenu = async () => {
  const response =
    await fetch(
      `${WEB_MENU_URL}${WEB_MENU_URL.includes('?') ? '&' : '?'}_ts=${Date.now()}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      }
    );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch web menu. HTTP ${response.status}`
    );
  }

  const payload =
    await response.json();

  const debugSource =
    getDebugSourceFromPayload(
      payload
    );

  const rawItems =
    extractMenuItemsFromPayload(
      payload
    );

  console.log(
    'NODE MENU WEB DEBUG SOURCE:',
    debugSource
  );

  console.log(
    'NODE MENU RAW ITEMS COUNT:',
    rawItems.length
  );

  const items =
    rawItems.map(
      normalizeMenuItem
    );

  return {
    debugSource,
    items,
  };
};

const sortMenuItems = (items = []) => {
  return [...items].sort((a, b) => {
    const aAvailable =
      a.is_available === true;

    const bAvailable =
      b.is_available === true;

    const aBest =
      a.is_best_seller === true;

    const bBest =
      b.is_best_seller === true;

    if (aAvailable !== bAvailable) {
      return Number(bAvailable) -
        Number(aAvailable);
    }

    if (aBest !== bBest) {
      return Number(bBest) -
        Number(aBest);
    }

    return String(a.name || '')
      .localeCompare(
        String(b.name || '')
      );
  });
};

// =========================
// GET ALL MENU ITEMS
// GET /api/menu
// =========================

router.get('/', async (req, res) => {
  try {
    const {
      debugSource,
      items,
    } = await fetchWebIngredientMenu();

    if (
      debugSource &&
      debugSource !== EXPECTED_DEBUG_SOURCE
    ) {
      console.log(
        'WARNING: UNEXPECTED MENU DEBUG SOURCE:',
        debugSource
      );
    }

    return res.json({
      success: true,
      debug_source:
        EXPECTED_DEBUG_SOURCE,
      source_debug:
        debugSource,
      data:
        sortMenuItems(items),
    });
  } catch (error) {
    console.log(
      'MENU ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      debug_source:
        EXPECTED_DEBUG_SOURCE,
      message:
        error.message ||
        'Failed to fetch menu',
      data: [],
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
      const {
        items,
      } = await fetchWebIngredientMenu();

      const bestSellers =
        sortMenuItems(items)
          .filter((item) =>
            item.is_best_seller === true &&
            item.is_available === true
          )
          .slice(0, 3);

      return res.json({
        success: true,
        debug_source:
          EXPECTED_DEBUG_SOURCE,
        data:
          bestSellers,
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
        data: [],
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
      const category =
        normalizeText(
          req.params.category
        );

      const {
        items,
      } = await fetchWebIngredientMenu();

      const filteredItems =
        sortMenuItems(items)
          .filter((item) =>
            normalizeText(item.category) ===
            category
          );

      return res.json({
        success: true,
        debug_source:
          EXPECTED_DEBUG_SOURCE,
        data:
          filteredItems,
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
        data: [],
      });
    }
  }
);

module.exports = router;