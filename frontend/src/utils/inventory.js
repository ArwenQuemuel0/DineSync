const VALID_NORMAL_INVENTORY_TYPES = [
  'per_order',
  'per_head',
];

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

export const hasInventoryType = (item) => {
  return (
    item?.inventory_type !== null &&
    item?.inventory_type !== undefined &&
    String(item.inventory_type).trim() !== ''
  );
};

export const hasDailyLimit = (item) => {
  return (
    item?.daily_limit !== null &&
    item?.daily_limit !== undefined &&
    String(item.daily_limit).trim() !== ''
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
        1
    );

  return Number.isFinite(maxQuantity)
    ? Math.max(0, maxQuantity)
    : 1;
};

export const getRemainingToday = (item) => {
  const remaining =
    toNumberOrNull(
      item?.remaining_today
    );

  return remaining;
};

export const isValidDailyInventoryMenuItem = (item) => {
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

  return getMaxOrderQuantity(item) > 0;
};

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

  return isValidDailyInventoryMenuItem(
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
    return 'This item is sold out for today.';
  }

  return `You can only order up to ${maxQuantity} of this item today.`;
};

export const getAvailabilityDisplayText = (item) => {
  if (!item) {
    return 'Unavailable';
  }

  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  if (
    !isAvailableTrue(
      item?.is_available
    )
  ) {
    return 'Unavailable';
  }

  if (!hasInventoryType(item)) {
    return 'Not enabled today';
  }

  if (inventoryType === 'custom') {
    return 'Custom request available';
  }

  if (
    !VALID_NORMAL_INVENTORY_TYPES.includes(
      inventoryType
    )
  ) {
    return 'Invalid inventory setup';
  }

  if (!hasDailyLimit(item)) {
    return 'No daily limit set';
  }

  const maxQuantity =
    getMaxOrderQuantity(item);

  if (maxQuantity <= 0) {
    return 'Sold out today';
  }

  if (item?.daily_inventory_label) {
    return String(
      item.daily_inventory_label
    );
  }

  if (item?.stock_label) {
    return String(
      item.stock_label
    );
  }

  return `${maxQuantity} orders left today`;
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
      item?.inventory_type ?? null,

    daily_limit:
      item?.daily_limit ?? null,

    sold_today:
      item?.sold_today ?? null,

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
    daily_limit:
      liveInventory.daily_limit ??
      item?.daily_limit ??
      null,
    inventory_type:
      liveInventory.inventory_type ??
      item?.inventory_type ??
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
      !isValidDailyInventoryMenuItem(
        liveItem
      )
    ) {
      return {
        valid: false,
        message:
          `${cartItem?.name || 'An item'} is no longer available today.`,
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
          `${cartItem?.name || 'An item'} is sold out for today.`,
      };
    }

    if (
      requestedQuantity >
      maxQuantity
    ) {
      return {
        valid: false,
        message:
          `${cartItem?.name || 'An item'} only has ${maxQuantity} available today.`,
      };
    }
  }

  return {
    valid: true,
    message: '',
  };
};