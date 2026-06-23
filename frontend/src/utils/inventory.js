const parseNumeric = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
};

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
};

export const getItemId = (item) => {
  const id =
    item?.id ?? item?.menu_item_id;

  if (
    id === undefined ||
    id === null ||
    id === ''
  ) {
    return null;
  }

  return String(id);
};

export const getInventoryType = (item) => {
  const type =
    normalizeText(item?.inventory_type);

  if (
    type === 'per order' ||
    type === 'per_order'
  ) {
    return 'per_order';
  }

  if (
    type === 'per head' ||
    type === 'per_head'
  ) {
    return 'per_head';
  }

  if (type === 'custom') {
    return 'custom';
  }

  return type || null;
};

export const isCustomItem = (item) => {
  const category =
    normalizeText(item?.category);

  const inventoryType =
    getInventoryType(item);

  return (
    inventoryType === 'custom' ||
    category === 'chef oppa special'
  );
};

const isMarkedUnavailable = (item) => {
  const availability =
    item?.is_available;

  return (
    availability === false ||
    availability === 0 ||
    availability === 'false' ||
    availability === '0' ||
    normalizeText(availability) === 'false' ||
    normalizeText(availability) === 'no'
  );
};

export const getMaxOrderQuantity = (item) => {
  if (isCustomItem(item)) {
    return null;
  }

  const inventoryType =
    getInventoryType(item);

  const maxOrder =
    parseNumeric(
      item?.max_order_quantity
    );

  const remainingToday =
    parseNumeric(
      item?.remaining_today
    );

  const availableQuantity =
    parseNumeric(
      item?.available_quantity
    );

  if (
    inventoryType === 'per_order' ||
    inventoryType === 'per_head'
  ) {
    const candidates = [
      maxOrder,
      remainingToday,
      availableQuantity,
    ].filter(
      (value) =>
        value !== null &&
        value >= 0
    );

    if (candidates.length === 0) {
      return null;
    }

    return Math.max(
      0,
      Math.min(...candidates)
    );
  }

  if (maxOrder !== null) {
    return maxOrder;
  }

  return availableQuantity;
};

export const pickInventoryFields = (item) => {
  const max =
    getMaxOrderQuantity(item);

  return {
    inventory_type:
      item?.inventory_type ?? null,

    daily_limit:
      parseNumeric(
        item?.daily_limit
      ),

    sold_today:
      parseNumeric(
        item?.sold_today
      ),

    remaining_today:
      parseNumeric(
        item?.remaining_today
      ),

    daily_inventory_label:
      item?.daily_inventory_label
        ? String(
            item.daily_inventory_label
          ).trim()
        : null,

    max_order_quantity:
      max,

    available_quantity:
      parseNumeric(
        item?.available_quantity
      ) ?? max,

    is_available:
      item?.is_available,

    stock_label:
      item?.stock_label
        ? String(item.stock_label).trim()
        : null,
  };
};

export const buildInventoryMap = (
  menuItems = []
) => {
  const map = {};

  for (const item of menuItems) {
    const id = getItemId(item);

    if (id == null) {
      continue;
    }

    map[id] = {
      ...pickInventoryFields(item),
      id,
      menu_item_id: id,
      name: item?.name,
      category: item?.category,
      price: item?.price,
      image_url: item?.image_url,
      image: item?.image,
    };
  }

  return map;
};

export const enrichCartItem = (
  cartItem,
  inventoryByItemId = {}
) => {
  const id = getItemId(cartItem);

  if (id == null) {
    return cartItem;
  }

  const menuInventory =
    inventoryByItemId[id];

  if (!menuInventory) {
    return cartItem;
  }

  return {
    ...cartItem,
    ...menuInventory,
    max_order_quantity:
      menuInventory.max_order_quantity ??
      getMaxOrderQuantity(cartItem),
  };
};

export const enrichCartItems = (
  cartItems = [],
  inventoryByItemId = {}
) =>
  cartItems.map((item) =>
    enrichCartItem(
      item,
      inventoryByItemId
    )
  );

export const isOutOfStock = (item) => {
  if (isMarkedUnavailable(item)) {
    return true;
  }

  if (isCustomItem(item)) {
    return false;
  }

  const inventoryType =
    getInventoryType(item);

  const dailyLimit =
    parseNumeric(
      item?.daily_limit
    );

  const remainingToday =
    parseNumeric(
      item?.remaining_today
    );

  if (
    (
      inventoryType === 'per_order' ||
      inventoryType === 'per_head'
    ) &&
    dailyLimit !== null &&
    remainingToday !== null &&
    remainingToday <= 0
  ) {
    return true;
  }

  const max =
    getMaxOrderQuantity(item);

  if (max !== null) {
    return max <= 0;
  }

  return false;
};

export const isItemOrderable = (item) => {
  if (isMarkedUnavailable(item)) {
    return false;
  }

  if (isCustomItem(item)) {
    return true;
  }

  if (isOutOfStock(item)) {
    return false;
  }

  const max =
    getMaxOrderQuantity(item);

  if (max !== null) {
    return max > 0;
  }

  return true;
};

export const shouldShowLowStockWarning = (item) => {
  if (isCustomItem(item)) {
    return false;
  }

  const remainingToday =
    parseNumeric(
      item?.remaining_today
    );

  const max =
    getMaxOrderQuantity(item);

  const value =
    remainingToday ?? max;

  return (
    value !== null &&
    value >= 1 &&
    value <= 5
  );
};

export const getLowStockLabel = (item) => {
  if (!shouldShowLowStockWarning(item)) {
    return null;
  }

  const stockLabel =
    item?.stock_label
      ? String(item.stock_label).trim()
      : '';

  if (stockLabel) {
    return stockLabel;
  }

  const inventoryType =
    getInventoryType(item);

  const remainingToday =
    parseNumeric(
      item?.remaining_today
    );

  const max =
    getMaxOrderQuantity(item);

  const value =
    remainingToday ?? max;

  if (inventoryType === 'per_head') {
    return value === 1
      ? 'Only 1 head left today'
      : `Only ${value} heads left today`;
  }

  return value === 1
    ? 'Only 1 order left today'
    : `Only ${value} orders left today`;
};

export const getAvailabilityDisplayText = (item) => {
  if (isMarkedUnavailable(item)) {
    return 'Unavailable';
  }

  if (isCustomItem(item)) {
    return 'Staff confirms';
  }

  const inventoryType =
    getInventoryType(item);

  const dailyLimit =
    parseNumeric(
      item?.daily_limit
    );

  const remainingToday =
    parseNumeric(
      item?.remaining_today
    );

  if (
    (
      inventoryType === 'per_order' ||
      inventoryType === 'per_head'
    ) &&
    dailyLimit !== null &&
    remainingToday !== null &&
    remainingToday <= 0
  ) {
    return 'Sold out for today';
  }

  const dailyInventoryLabel =
    item?.daily_inventory_label
      ? String(
          item.daily_inventory_label
        ).trim()
      : '';

  if (dailyInventoryLabel) {
    return dailyInventoryLabel;
  }

  const lowStockLabel =
    getLowStockLabel(item);

  if (lowStockLabel) {
    return lowStockLabel;
  }

  const stockLabel =
    item?.stock_label
      ? String(item.stock_label).trim()
      : '';

  if (stockLabel) {
    return stockLabel;
  }

  if (
    inventoryType === 'per_order' &&
    remainingToday !== null
  ) {
    return `${remainingToday} orders left today`;
  }

  if (
    inventoryType === 'per_head' &&
    remainingToday !== null
  ) {
    return `${remainingToday} heads left today`;
  }

  if (isItemOrderable(item)) {
    return 'Available';
  }

  return 'Sold out for today';
};

export const getQuantityLimitMessage = (item) => {
  if (isCustomItem(item)) {
    return 'Chef Oppa Special requests are limited to 1 request per cart entry.';
  }

  const max =
    getMaxOrderQuantity(item);

  if (max === null || max <= 0) {
    return 'This item is currently not available.';
  }

  const inventoryType =
    getInventoryType(item);

  if (inventoryType === 'per_head') {
    return `Only ${max} head${max === 1 ? '' : 's'} left today.`;
  }

  return `Only ${max} order${max === 1 ? '' : 's'} left today.`;
};

export const getCheckoutLimitMessage = (item) => {
  const name =
    item?.name || 'This item';

  if (isCustomItem(item)) {
    return `${name} requires staff confirmation.`;
  }

  const max =
    getMaxOrderQuantity(item);

  if (max === null || max <= 0) {
    return `${name} is sold out for today.`;
  }

  const inventoryType =
    getInventoryType(item);

  if (inventoryType === 'per_head') {
    return `${name} only has ${max} head${max === 1 ? '' : 's'} left today.`;
  }

  return `${name} only has ${max} order${max === 1 ? '' : 's'} left today.`;
};

export const canIncreaseQuantity = (
  item,
  currentQuantity,
  increaseBy = 1
) => {
  if (isCustomItem(item)) {
    return false;
  }

  if (isOutOfStock(item)) {
    return false;
  }

  const max =
    getMaxOrderQuantity(item);

  if (max === null) {
    return false;
  }

  return (
    Number(currentQuantity) +
      Number(increaseBy) <=
    max
  );
};

export const validateCartInventory = (
  cartItems,
  inventoryByItemId = {}
) => {
  const enrichedItems =
    enrichCartItems(
      cartItems,
      inventoryByItemId
    );

  for (const item of enrichedItems) {
    const quantity =
      Number(item.quantity) || 0;

    if (isCustomItem(item)) {
      if (!isItemOrderable(item)) {
        return {
          valid: false,
          message:
            `${item?.name || 'Chef Oppa Special'} is currently unavailable.`,
          item,
        };
      }

      continue;
    }

    const max =
      getMaxOrderQuantity(item);

    if (max === null) {
      if (quantity > 0) {
        return {
          valid: false,
          message:
            `${item?.name || 'An item'} inventory could not be verified. Please refresh the menu.`,
          item,
        };
      }

      continue;
    }

    if (quantity > max) {
      return {
        valid: false,
        message:
          getCheckoutLimitMessage(item),
        item,
      };
    }

    if (
      quantity > 0 &&
      !isItemOrderable(item)
    ) {
      return {
        valid: false,
        message:
          getCheckoutLimitMessage(item),
        item,
      };
    }
  }

  return { valid: true };
};