const express = require('express');
const axios = require('axios');

const router = express.Router();

const LARAVEL_MENU_URL =
  process.env.LARAVEL_MENU_URL ||
  'https://dinesync.shop/api/menu';

const EXPECTED_DEBUG_SOURCE =
  'WEB_MENU_INGREDIENT_AVAILABILITY_FIXED_2026';

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase();
};

const normalizeInventoryType = (value) => {
  return normalizeText(value)
    .replace(/[-\s]+/g, '_');
};

const getValue = (object, key, fallback) => {
  if (!object) {
    return fallback;
  }

  if (
    object[key] === undefined ||
    object[key] === null
  ) {
    return fallback;
  }

  return object[key];
};

const toNumber = (value, fallback) => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : fallback;
};

const normalizeBoolean = (value) => {
  const text = normalizeText(value);

  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    text === 'true' ||
    text === 'yes' ||
    text === 'available'
  );
};

const isCustomItem = (item) => {
  const category =
    normalizeText(
      getValue(item, 'category', '')
    );

  const inventoryType =
    normalizeInventoryType(
      getValue(item, 'inventory_type', '')
    );

  const name =
    normalizeText(
      getValue(item, 'name', '')
    );

  return (
    category === 'chef oppa special' ||
    inventoryType === 'custom' ||
    name.includes('custom chef oppa special')
  );
};

const getImageUrl = (item) => {
  return (
    getValue(item, 'image_url', null) ||
    getValue(item, 'image', null)
  );
};

const getDescription = (item) => {
  return (
    getValue(item, 'description', '') ||
    getValue(item, 'item_description', '') ||
    getValue(item, 'details', '') ||
    getValue(item, 'desc', '') ||
    ''
  );
};

const normalizeFlavorTags = (item) => {
  const tags =
    getValue(item, 'flavor_tags', []);

  if (Array.isArray(tags)) {
    return tags;
  }

  if (!tags) {
    return [];
  }

  return String(tags)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const extractMenuItems = (payload) => {
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

  return [];
};

const getRawMaxQty = (item) => {
  const maxOrderQuantity =
    getValue(
      item,
      'max_order_quantity',
      null
    );

  const availableQuantity =
    getValue(
      item,
      'available_quantity',
      null
    );

  const remainingToday =
    getValue(
      item,
      'remaining_today',
      null
    );

  if (maxOrderQuantity !== null) {
    return maxOrderQuantity;
  }

  if (availableQuantity !== null) {
    return availableQuantity;
  }

  if (remainingToday !== null) {
    return remainingToday;
  }

  return 0;
};

const normalizeMenuItemForMobile = (item) => {
  const custom =
    isCustomItem(item);

  const id =
    getValue(item, 'id', null) ||
    getValue(item, 'menu_item_id', null);

  const baseItem = {
    id,

    menu_item_id:
      getValue(item, 'menu_item_id', null) ||
      id,

    name:
      getValue(item, 'name', ''),

    category:
      getValue(item, 'category', ''),

    price:
      toNumber(
        getValue(item, 'price', 0),
        0
      ),

    description:
      getDescription(item),

    image:
      getImageUrl(item),

    image_url:
      getImageUrl(item),

    flavor_tags:
      normalizeFlavorTags(item),

    meal_type:
      getValue(item, 'meal_type', 'main'),

    ingredients:
      Array.isArray(
        getValue(item, 'ingredients', [])
      )
        ? getValue(item, 'ingredients', [])
        : [],
  };

  if (custom) {
    return Object.assign(
      {},
      item,
      baseItem,
      {
        category:
          getValue(
            item,
            'category',
            'Chef Oppa Special'
          ),

        is_available: true,

        max_order_quantity: 1,

        available_quantity: 1,

        remaining_today: 1,

        stock_label:
          'Custom request available',

        daily_inventory_label:
          'Custom request available',

        unavailable_reason: null,

        inventory_type: 'custom',

        meal_type:
          getValue(item, 'meal_type', 'extra'),
      }
    );
  }

  const backendAvailable =
    normalizeBoolean(
      getValue(item, 'is_available', false)
    );

  const maxQty =
    Math.max(
      0,
      toNumber(getRawMaxQty(item), 0)
    );

  const finalAvailable =
    backendAvailable && maxQty > 0;

  const finalQty =
    finalAvailable ? maxQty : 0;

  const availableLabel =
    'Only ' +
    finalQty +
    ' order(s) available based on ingredient stock.';

  const unavailableLabel =
    'Unavailable based on ingredient stock.';

  const stockLabel =
    finalAvailable
      ? (
          getValue(item, 'stock_label', null) ||
          getValue(item, 'daily_inventory_label', null) ||
          availableLabel
        )
      : (
          getValue(item, 'stock_label', null) ||
          getValue(item, 'daily_inventory_label', null) ||
          unavailableLabel
        );

  const dailyInventoryLabel =
    finalAvailable
      ? (
          getValue(item, 'daily_inventory_label', null) ||
          getValue(item, 'stock_label', null) ||
          availableLabel
        )
      : (
          getValue(item, 'daily_inventory_label', null) ||
          getValue(item, 'stock_label', null) ||
          unavailableLabel
        );

  return Object.assign(
    {},
    item,
    baseItem,
    {
      is_available:
        finalAvailable,

      max_order_quantity:
        finalQty,

      available_quantity:
        finalQty,

      remaining_today:
        finalQty,

      stock_label:
        stockLabel,

      daily_inventory_label:
        dailyInventoryLabel,

      unavailable_reason:
        finalAvailable
          ? null
          : (
              getValue(item, 'unavailable_reason', null) ||
              unavailableLabel
            ),

      inventory_type:
        getValue(
          item,
          'inventory_type',
          'ingredient'
        ),
    }
  );
};

router.get('/', async (req, res) => {
  try {
    console.log(
      'NODE MENU PROXY TARGET:',
      LARAVEL_MENU_URL
    );

    const response =
      await axios.get(
        LARAVEL_MENU_URL,
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

    const rawPayload =
      response.data;

    const rawItems =
      extractMenuItems(rawPayload);

    const normalizedItems =
      rawItems.map(
        normalizeMenuItemForMobile
      );

    console.log(
      'NODE MENU LARAVEL DEBUG SOURCE:',
      rawPayload &&
      rawPayload.debug_source
        ? rawPayload.debug_source
        : null
    );

    console.log(
      'NODE MENU ITEMS COUNT:',
      normalizedItems.length
    );

    return res
      .status(200)
      .set({
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma:
          'no-cache',
        Expires:
          '0',
        'Surrogate-Control':
          'no-store',
      })
      .json({
        success: true,

        debug_source:
          EXPECTED_DEBUG_SOURCE,

        proxied_from:
          LARAVEL_MENU_URL,

        laravel_debug_source:
          rawPayload &&
          rawPayload.debug_source
            ? rawPayload.debug_source
            : null,

        data:
          normalizedItems,
      });
  } catch (error) {
    console.error(
      'NODE MENU PROXY ERROR:',
      {
        message:
          error &&
          error.message
            ? error.message
            : 'Unknown error',

        status:
          error &&
          error.response
            ? error.response.status
            : null,

        data:
          error &&
          error.response
            ? error.response.data
            : null,
      }
    );

    return res
      .status(500)
      .json({
        success: false,

        debug_source:
          'NODE_MENU_PROXY_ERROR',

        message:
          'Failed to fetch fixed Laravel menu inventory.',

        error:
          error &&
          error.message
            ? error.message
            : 'Unknown error',
      });
  }
});

module.exports = router;