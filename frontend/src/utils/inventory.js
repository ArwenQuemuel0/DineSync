export const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase();
};

export const normalizeInventoryType = (value) => {
  return normalizeText(value)
    .replace(/[-\s]+/g, '_');
};

export const toNumberOrNull = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const numberValue =
    Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
};

export const toNumberOrZero = (value) => {
  const numberValue =
    Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
};

export const getItemId = (item) => {
  const id =
    item?.menu_item_id ??
    item?.menuItemId ??
    item?.menu_item?.id ??
    item?.id;

  if (
    id === null ||
    id === undefined ||
    String(id).trim() === ''
  ) {
    return null;
  }

  return String(id);
};

export const isAvailableTrue = (value) => {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    normalizeText(value) === 'true' ||
    normalizeText(value) === 'yes' ||
    normalizeText(value) === 'available'
  );
};

export const isCustomItem = (item) => {
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

export const getMaxOrderQuantity = (item) => {
  if (!item) {
    return 0;
  }

  if (isCustomItem(item)) {
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

export const getRemainingToday = (item) => {
  if (!item) {
    return 0;
  }

  if (isCustomItem(item)) {
    return 1;
  }

  const remaining =
    Number(
      item?.remaining_today ??
        item?.available_quantity ??
        item?.max_order_quantity ??
        0
    );

  return Number.isFinite(remaining)
    ? Math.max(0, remaining)
    : 0;
};

export const isValidIngredientInventoryMenuItem = (item) => {
  if (!item) {
    return false;
  }

  if (
    !isAvailableTrue(
      item?.is_available
    )
  ) {
    return false;
  }

  if (isCustomItem(item)) {
    return true;
  }

  return (
    getMaxOrderQuantity(item) > 0 ||
    getRemainingToday(item) > 0
  );
};

// Compatibility alias para hindi masira ibang imports
export const isValidDailyInventoryMenuItem =
  isValidIngredientInventoryMenuItem;

export const isOutOfStock = (item) => {
  if (!item) {
    return true;
  }

  if (isCustomItem(item)) {
    return !isAvailableTrue(
      item?.is_available
    );
  }

  return (
    !isAvailableTrue(
      item?.is_available
    ) ||
    getMaxOrderQuantity(item) <= 0
  );
};

export const isItemOrderable = (item) => {
  if (!item) {
    return false;
  }

  return isValidIngredientInventoryMenuItem(
    item
  );
};

export const canIncreaseQuantity = (
  item,
  currentQuantity = 0,
  increaseBy = 1
) => {
  if (!item) {
    return false;
  }

  if (isCustomItem(item)) {
    return false;
  }

  if (!isItemOrderable(item)) {
    return false;
  }

  const maxQuantity =
    getMaxOrderQuantity(item);

  const current =
    Number(currentQuantity) || 0;

  const increase =
    Number(increaseBy) || 1;

  return current + increase <= maxQuantity;
};

export const clampQuantity = (
  item,
  quantity
) => {
  if (isCustomItem(item)) {
    return 1;
  }

  const maxQuantity =
    getMaxOrderQuantity(item);

  const nextQuantity =
    Number(quantity) || 0;

  if (maxQuantity <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      nextQuantity,
      maxQuantity
    )
  );
};

export const getQuantityLimitMessage = (item) => {
  const maxQuantity =
    getMaxOrderQuantity(item);

  if (isCustomItem(item)) {
    return 'Chef Oppa Special requests have quantity fixed to 1.';
  }

  if (maxQuantity <= 0) {
    return (
      item?.unavailable_reason ||
      'This item is currently out of stock.'
    );
  }

  return `You can only order up to ${maxQuantity} of this item.`;
};

export const getAvailabilityDisplayText = (item) => {
  if (!item) {
    return 'Unavailable';
  }

  if (
    !isAvailableTrue(
      item?.is_available
    )
  ) {
    return (
      item?.unavailable_reason ||
      'Unavailable based on ingredient stock'
    );
  }

  if (isCustomItem(item)) {
    return 'Custom request available';
  }

  const maxQuantity =
    getMaxOrderQuantity(item);

  if (maxQuantity <= 0) {
    return (
      item?.unavailable_reason ||
      'Out of stock'
    );
  }

  if (item?.stock_label) {
    return String(
      item.stock_label
    );
  }

  if (item?.daily_inventory_label) {
    return String(
      item.daily_inventory_label
    );
  }

  return `${maxQuantity} order(s) available`;
};

export const shouldShowLowStockWarning = (item) => {
  if (!item || isCustomItem(item)) {
    return false;
  }

  const maxQuantity =
    getMaxOrderQuantity(item);

  return (
    maxQuantity > 0 &&
    maxQuantity <= 5
  );
};

export const pickInventoryFields = (item) => {
  return {
    inventory_type:
      item?.inventory_type ?? 'ingredient',

    remaining_today:
      item?.remaining_today ?? null,

    max_order_quantity:
      item?.max_order_quantity ?? null,

    available_quantity:
      item?.available_quantity ?? null,

    is_available:
      item?.is_available,

    stock_label:
      item?.stock_label ?? null,

    daily_inventory_label:
      item?.daily_inventory_label ?? null,

    unavailable_reason:
      item?.unavailable_reason ?? null,
  };
};

export const enrichCartItem = (
  item,
  inventoryMap = {}
) => {
  const itemId =
    getItemId(item);

  const liveInventory =
    itemId
      ? inventoryMap[itemId]
      : null;

  if (!liveInventory) {
    return {
      ...item,
      ...pickInventoryFields(item),
    };
  }

  return {
    ...item,
    ...liveInventory,
    max_order_quantity:
      liveInventory.max_order_quantity ??
      item?.max_order_quantity ??
      null,

    remaining_today:
      liveInventory.remaining_today ??
      item?.remaining_today ??
      null,

    available_quantity:
      liveInventory.available_quantity ??
      item?.available_quantity ??
      null,

    inventory_type:
      liveInventory.inventory_type ??
      item?.inventory_type ??
      'ingredient',

    is_available:
      liveInventory.is_available ??
      item?.is_available,

    stock_label:
      liveInventory.stock_label ??
      item?.stock_label ??
      null,

    unavailable_reason:
      liveInventory.unavailable_reason ??
      item?.unavailable_reason ??
      null,
  };
};

export const buildInventoryMap = (
  menuItems = []
) => {
  const map = {};

  if (!Array.isArray(menuItems)) {
    return map;
  }

  menuItems.forEach((item) => {
    const itemId =
      getItemId(item);

    if (!itemId) {
      return;
    }

    map[itemId] = {
      ...pickInventoryFields(item),
      id: itemId,
      menu_item_id: itemId,
      name: item?.name,
      price: item?.price,
      category: item?.category,
      image: item?.image,
      image_url: item?.image_url,
    };
  });

  return map;
};

export const validateCartInventory = (
  cartItems = [],
  inventoryMap = {}
) => {
  if (
    !Array.isArray(cartItems) ||
    cartItems.length === 0
  ) {
    return {
      valid: false,
      message:
        'Please add at least one item before confirming your order.',
    };
  }

  for (const cartItem of cartItems) {
    const itemId =
      getItemId(cartItem);

    const liveItem =
      itemId && inventoryMap[itemId]
        ? {
            ...cartItem,
            ...inventoryMap[itemId],
          }
        : cartItem;

    if (isCustomItem(liveItem)) {
      if (
        Number(cartItem.quantity || 0) !== 1
      ) {
        return {
          valid: false,
          message:
            'Chef Oppa Special requests must have quantity of 1 only.',
        };
      }

      continue;
    }

    if (
      !isValidIngredientInventoryMenuItem(
        liveItem
      )
    ) {
      return {
        valid: false,
        message:
          `${cartItem?.name || 'An item'} is no longer available based on ingredient stock.`,
      };
    }

    const maxQuantity =
      getMaxOrderQuantity(liveItem);

    const requestedQuantity =
      Number(cartItem.quantity || 0);

    if (maxQuantity <= 0) {
      return {
        valid: false,
        message:
          `${cartItem?.name || 'An item'} is currently out of stock.`,
      };
    }

    if (
      requestedQuantity >
      maxQuantity
    ) {
      return {
        valid: false,
        message:
          `${cartItem?.name || 'An item'} only has ${maxQuantity} available based on ingredient stock.`,
      };
    }
  }

  return {
    valid: true,
    message: '',
  };
};