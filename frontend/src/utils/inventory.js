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

export const getItemId = (item) => {
  const id =
    item?.id || item?.menu_item_id;

  if (
    id === undefined ||
    id === null ||
    id === ''
  ) {
    return null;
  }

  return String(id);
};

// Limits come from the API, which is computed from web-managed
// database values (ingredient stock + recipe usage).
export const getMaxOrderQuantity = (item) => {
  const maxOrder =
    parseNumeric(item?.max_order_quantity);

  if (maxOrder !== null) {
    return maxOrder;
  }

  return parseNumeric(
    item?.available_quantity
  );
};

export const pickInventoryFields = (item) => {
  const max =
    getMaxOrderQuantity(item);

  return {
    max_order_quantity: max,
    available_quantity:
      parseNumeric(
        item?.available_quantity
      ) ?? max,
    is_available: item?.is_available,
    stock_label: item?.stock_label
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

    map[id] = pickInventoryFields(item);
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

const isMarkedUnavailable = (item) => {
  const availability = item?.is_available;

  return (
    availability === false ||
    availability === 0 ||
    availability === 'false' ||
    availability === '0'
  );
};

export const isOutOfStock = (item) => {
  const max = getMaxOrderQuantity(item);

  if (max !== null) {
    return max <= 0;
  }

  return isMarkedUnavailable(item);
};

export const isItemOrderable = (item) => {
  if (isOutOfStock(item)) {
    return false;
  }

  if (isMarkedUnavailable(item)) {
    return false;
  }

  const max = getMaxOrderQuantity(item);

  if (max !== null) {
    return max > 0;
  }

  return true;
};

export const shouldShowLowStockWarning = (item) => {
  const max = getMaxOrderQuantity(item);

  return (
    max !== null &&
    max >= 1 &&
    max <= 5
  );
};

export const getLowStockLabel = (item) => {
  if (!shouldShowLowStockWarning(item)) {
    return null;
  }

  const stockLabel = item?.stock_label
    ? String(item.stock_label).trim()
    : '';

  if (stockLabel) {
    return stockLabel;
  }

  const max = getMaxOrderQuantity(item);

  if (max === 1) {
    return 'Only 1 order left';
  }

  return `Only ${max} orders left`;
};

export const getAvailabilityDisplayText = (item) => {
  if (isOutOfStock(item)) {
    return 'Out of stock';
  }

  const lowStockLabel =
    getLowStockLabel(item);

  if (lowStockLabel) {
    return lowStockLabel;
  }

  if (isItemOrderable(item)) {
    return 'Available';
  }

  return 'Sold Out';
};

export const getQuantityLimitMessage = (item) => {
  const max = getMaxOrderQuantity(item);

  if (max === null || max <= 0) {
    return 'This item is currently not available.';
  }

  return `Only ${max} order${max === 1 ? '' : 's'} left for this item.`;
};

export const getCheckoutLimitMessage = (item) => {
  const max = getMaxOrderQuantity(item);
  const name =
    item?.name || 'This item';

  if (max === null || max <= 0) {
    return `${name} is out of stock.`;
  }

  return `${name} only has ${max} orders left.`;
};

export const canIncreaseQuantity = (
  item,
  currentQuantity,
  increaseBy = 1
) => {
  if (isOutOfStock(item)) {
    return false;
  }

  const max = getMaxOrderQuantity(item);

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
    const max =
      getMaxOrderQuantity(item);

    const quantity =
      Number(item.quantity) || 0;

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

