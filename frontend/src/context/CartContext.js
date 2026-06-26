import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useRef,
  useEffect,
} from 'react';

import { Alert } from 'react-native';

import { getMenu } from '../api/dinesync';

import {
  getItemId,
  getMaxOrderQuantity,
  isItemOrderable,
  isOutOfStock,
  canIncreaseQuantity,
  getQuantityLimitMessage,
  validateCartInventory,
  pickInventoryFields,
  buildInventoryMap,
  enrichCartItem,
  isCustomItem,
} from '../utils/inventory';

const CartContext =
  createContext();

export const useCart = () =>
  useContext(CartContext);

const VALID_NORMAL_INVENTORY_TYPES = [
  'per_order',
  'per_head',
];

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase();
};

const normalizeInventoryType = (
  value
) => {
  return normalizeText(value)
    .replace(/[-\s]+/g, '_');
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

const hasInventoryType = (item) => {
  return (
    item?.inventory_type !== null &&
    item?.inventory_type !== undefined &&
    String(item.inventory_type).trim() !== ''
  );
};

const hasDailyLimit = (item) => {
  return (
    item?.daily_limit !== null &&
    item?.daily_limit !== undefined &&
    String(item.daily_limit).trim() !== ''
  );
};

const toNumber = (value) => {
  const numberValue =
    Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
};

const getRemainingToday = (item) => {
  return toNumber(
    item?.remaining_today
  );
};

const getSafeMaxOrderQuantity = (
  item
) => {
  const importedMax =
    getMaxOrderQuantity(item);

  if (
    importedMax !== null &&
    importedMax !== undefined &&
    Number.isFinite(
      Number(importedMax)
    )
  ) {
    return Number(importedMax);
  }

  return toNumber(
    item?.max_order_quantity
  );
};

const getAllowedOrderQuantity = (
  item
) => {
  if (!item) {
    return 0;
  }

  if (isCustomItem(item)) {
    return 1;
  }

  const maxOrderQuantity =
    getSafeMaxOrderQuantity(item);

  const remainingToday =
    getRemainingToday(item);

  if (
    maxOrderQuantity > 0 &&
    remainingToday > 0
  ) {
    return Math.min(
      maxOrderQuantity,
      remainingToday
    );
  }

  if (maxOrderQuantity > 0) {
    return maxOrderQuantity;
  }

  if (remainingToday > 0) {
    return remainingToday;
  }

  return 0;
};

const isValidDailyInventoryMenuItem = (
  item
) => {
  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  const available =
    isAvailableTrue(
      item?.is_available
    );

  if (!available) {
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

  const remainingToday =
    getRemainingToday(item);

  const maxOrderQuantity =
    getSafeMaxOrderQuantity(item);

  return (
    remainingToday > 0 ||
    maxOrderQuantity > 0
  );
};

const getDailyInventoryMessage = (
  item
) => {
  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  if (
    !isAvailableTrue(
      item?.is_available
    )
  ) {
    return 'This item is currently unavailable.';
  }

  if (!hasInventoryType(item)) {
    return 'This item is not enabled in Daily Menu Inventory.';
  }

  if (
    inventoryType !== 'custom' &&
    !VALID_NORMAL_INVENTORY_TYPES.includes(
      inventoryType
    )
  ) {
    return 'This item has an invalid inventory type.';
  }

  if (
    inventoryType !== 'custom' &&
    !hasDailyLimit(item)
  ) {
    return 'This item has no daily limit set.';
  }

  if (
    inventoryType !== 'custom' &&
    getAllowedOrderQuantity(item) <= 0
  ) {
    return 'This item is sold out for today.';
  }

  return 'This item is not available today.';
};

const mergeAndClampCartItem = (
  cartItem,
  menuInventory
) => {
  if (!menuInventory) {
    return cartItem;
  }

  const merged = {
    ...cartItem,
    ...menuInventory,
    max_order_quantity:
      menuInventory.max_order_quantity ??
      getSafeMaxOrderQuantity(cartItem),
  };

  if (isCustomItem(merged)) {
    return {
      ...merged,
      quantity: 1,
      price: 0,
      notes:
        cartItem.notes ||
        cartItem.special_request ||
        '',
      special_request:
        cartItem.special_request ||
        cartItem.notes ||
        '',
      inventory_type: 'custom',
    };
  }

  const max =
    getAllowedOrderQuantity(merged);

  const quantity =
    Number(cartItem.quantity) || 0;

  if (max <= 0) {
    return {
      ...merged,
      quantity: 0,
    };
  }

  if (quantity > max) {
    return {
      ...merged,
      quantity: max,
    };
  }

  return merged;
};

const filterRemovedOrZeroQuantityItems =
  (items) => {
    return items.filter((item) => {
      if (isCustomItem(item)) {
        return true;
      }

      return (
        Number(item.quantity || 0) > 0 &&
        isValidDailyInventoryMenuItem(item)
      );
    });
  };

const validateDailyInventoryCartItems =
  (cartItems = []) => {
    for (const cartItem of cartItems) {
      const customItem =
        isCustomItem(cartItem);

      if (customItem) {
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
          cartItem
        )
      ) {
        return {
          valid: false,
          message:
            `${cartItem?.name || 'An item'} is no longer enabled in Daily Menu Inventory.`,
        };
      }

      const allowedQuantity =
        getAllowedOrderQuantity(cartItem);

      const requestedQuantity =
        Number(cartItem.quantity || 0);

      if (allowedQuantity <= 0) {
        return {
          valid: false,
          message:
            `${cartItem?.name || 'An item'} is sold out for today.`,
        };
      }

      if (
        requestedQuantity >
        allowedQuantity
      ) {
        return {
          valid: false,
          message:
            `${cartItem?.name || 'An item'} only has ${allowedQuantity} available today.`,
        };
      }
    }

    return {
      valid: true,
      message: '',
    };
  };

export const CartProvider = ({
  children,
}) => {
  const [cartItems, setCartItems] =
    useState([]);

  const [
    inventoryByItemId,
    setInventoryByItemId,
  ] = useState({});

  const [
    activeOrderId,
    setActiveOrderId,
  ] = useState(null);

  const cartItemsRef =
    useRef(cartItems);

  const inventoryRef =
    useRef(inventoryByItemId);

  useEffect(() => {
    cartItemsRef.current =
      cartItems;
  }, [cartItems]);

  useEffect(() => {
    inventoryRef.current =
      inventoryByItemId;
  }, [inventoryByItemId]);

  const applyMenuInventory =
    useCallback(
      (menuItems = []) => {
        const visibleMenuItems =
          Array.isArray(menuItems)
            ? menuItems.filter(
                isValidDailyInventoryMenuItem
              )
            : [];

        const inventoryMap =
          buildInventoryMap(
            visibleMenuItems
          );

        inventoryRef.current =
          inventoryMap;

        setInventoryByItemId(
          inventoryMap
        );

        let clamped = false;
        let removed = false;

        setCartItems((prevItems) => {
          const nextItemsBeforeFilter =
            prevItems.map(
              (cartItem) => {
                const id =
                  getItemId(cartItem);

                const menuInventory =
                  inventoryMap[id];

                const beforeQty =
                  Number(
                    cartItem.quantity
                  ) || 0;

                const updated =
                  mergeAndClampCartItem(
                    cartItem,
                    menuInventory
                  );

                const afterQty =
                  Number(
                    updated.quantity
                  ) || 0;

                if (
                  beforeQty !==
                  afterQty
                ) {
                  clamped = true;
                }

                return updated;
              }
            );

          const nextItems =
            filterRemovedOrZeroQuantityItems(
              nextItemsBeforeFilter
            );

          if (
            nextItems.length !==
            nextItemsBeforeFilter.length
          ) {
            removed = true;
          }

          cartItemsRef.current =
            nextItems;

          return nextItems;
        });

        return {
          inventoryMap,
          clamped,
          removed,
        };
      },
      []
    );

  const syncMenuInventory =
    useCallback(
      (menuItems = []) => {
        const result =
          applyMenuInventory(
            menuItems
          );

        if (
          result.clamped ||
          result.removed
        ) {
          Alert.alert(
            'Limited Stock',
            result.removed
              ? 'Some items in your cart were removed because they are no longer available today.'
              : 'Some items in your cart were adjusted to match current inventory.'
          );
        }
      },
      [applyMenuInventory]
    );

  const mergeInventoryItems =
    useCallback(
      (menuItems = []) => {
        if (
          !Array.isArray(menuItems) ||
          menuItems.length === 0
        ) {
          return;
        }

        const validMenuItems =
          menuItems.filter(
            isValidDailyInventoryMenuItem
          );

        const mergedMap = {
          ...inventoryRef.current,
          ...buildInventoryMap(
            validMenuItems
          ),
        };

        inventoryRef.current =
          mergedMap;

        setInventoryByItemId(
          mergedMap
        );

        let clamped = false;
        let removed = false;

        setCartItems((prevItems) => {
          const nextItemsBeforeFilter =
            prevItems.map(
              (cartItem) => {
                const id =
                  getItemId(cartItem);

                const menuInventory =
                  mergedMap[id];

                const beforeQty =
                  Number(
                    cartItem.quantity
                  ) || 0;

                const updated =
                  mergeAndClampCartItem(
                    cartItem,
                    menuInventory
                  );

                const afterQty =
                  Number(
                    updated.quantity
                  ) || 0;

                if (
                  beforeQty !==
                  afterQty
                ) {
                  clamped = true;
                }

                return updated;
              }
            );

          const nextItems =
            filterRemovedOrZeroQuantityItems(
              nextItemsBeforeFilter
            );

          if (
            nextItems.length !==
            nextItemsBeforeFilter.length
          ) {
            removed = true;
          }

          cartItemsRef.current =
            nextItems;

          return nextItems;
        });

        if (
          clamped ||
          removed
        ) {
          Alert.alert(
            'Limited Stock',
            removed
              ? 'Some items in your cart were removed because they are no longer available today.'
              : 'Some items in your cart were adjusted to match current inventory.'
          );
        }
      },
      []
    );

  const refreshCartInventory =
    useCallback(async () => {
      const response =
        await getMenu();

      if (
        !response?.success ||
        !Array.isArray(
          response.data
        )
      ) {
        const baseValidation =
          validateCartInventory(
            cartItemsRef.current,
            inventoryRef.current
          );

        if (!baseValidation.valid) {
          return baseValidation;
        }

        return validateDailyInventoryCartItems(
          cartItemsRef.current
        );
      }

      applyMenuInventory(
        response.data
      );

      const baseValidation =
        validateCartInventory(
          cartItemsRef.current,
          inventoryRef.current
        );

      if (!baseValidation.valid) {
        return baseValidation;
      }

      return validateDailyInventoryCartItems(
        cartItemsRef.current
      );
    }, [applyMenuInventory]);

  const resolveLiveItem =
    useCallback(
      (item) => {
        const itemId =
          getItemId(item);

        if (!itemId) {
          return {
            ...item,
            ...pickInventoryFields(item),
          };
        }

        const fromMap =
          inventoryRef.current[itemId];

        if (fromMap) {
          return {
            ...item,
            ...fromMap,
          };
        }

        return {
          ...item,
          ...pickInventoryFields(item),
        };
      },
      [inventoryByItemId]
    );

  const getEnrichedItem =
    useCallback(
      (item) =>
        resolveLiveItem(
          enrichCartItem(
            item,
            inventoryRef.current
          )
        ),
      [
        resolveLiveItem,
        inventoryByItemId,
      ]
    );

  const addToCart = (
    item,
    quantityToAdd = 1
  ) => {
    const liveItem =
      resolveLiveItem(item);

    const itemId =
      getItemId(liveItem);

    const addQty =
      Number(quantityToAdd) || 1;

    const inventoryFields =
      pickInventoryFields(
        liveItem
      );

    if (!itemId) {
      Alert.alert(
        'Item Error',
        'This item has no valid menu item ID.'
      );

      return false;
    }

    const orderableItem = {
      ...liveItem,
      ...inventoryFields,
    };

    const customItem =
      isCustomItem(orderableItem);

    if (
      !isValidDailyInventoryMenuItem(
        orderableItem
      )
    ) {
      Alert.alert(
        'Unavailable',
        getDailyInventoryMessage(
          orderableItem
        )
      );

      return false;
    }

    if (
      isOutOfStock(orderableItem) ||
      !isItemOrderable(orderableItem)
    ) {
      Alert.alert(
        'Out of Stock',
        'This item is currently out of stock.'
      );

      return false;
    }

    const allowedQuantity =
      getAllowedOrderQuantity(
        orderableItem
      );

    if (
      allowedQuantity <= 0 &&
      !customItem
    ) {
      Alert.alert(
        'Sold Out',
        'This item is sold out for today.'
      );

      return false;
    }

    const requestText =
      liveItem.special_request ||
      liveItem.notes ||
      '';

    let limitReached = false;
    let alreadyAddedCustom = false;

    setCartItems((prevItems) => {
      const existing =
        prevItems.find(
          (cartItem) =>
            getItemId(cartItem) ===
            itemId
        );

      const currentQty = existing
        ? Number(existing.quantity) || 0
        : 0;

      const enrichedExisting =
        existing
          ? resolveLiveItem({
              ...existing,
              ...inventoryFields,
            })
          : orderableItem;

      if (
        customItem &&
        currentQty >= 1
      ) {
        alreadyAddedCustom = true;
        return prevItems;
      }

      if (
        !customItem &&
        (
          currentQty + addQty >
            allowedQuantity ||
          !canIncreaseQuantity(
            enrichedExisting,
            currentQty,
            addQty
          )
        )
      ) {
        limitReached = true;
        return prevItems;
      }

      const nextQty =
        customItem
          ? 1
          : currentQty + addQty;

      let nextItems;

      if (existing) {
        nextItems = prevItems.map(
          (cartItem) =>
            getItemId(cartItem) ===
            itemId
              ? {
                  ...cartItem,
                  ...liveItem,
                  ...inventoryFields,
                  id: itemId,
                  menu_item_id: itemId,
                  quantity: nextQty,
                  price: customItem
                    ? 0
                    : Number(
                        liveItem.price
                      ) || 0,
                  notes: customItem
                    ? requestText
                    : cartItem.notes,
                  special_request:
                    customItem
                      ? requestText
                      : cartItem.special_request,
                  inventory_type:
                    customItem
                      ? 'custom'
                      : liveItem.inventory_type,
                }
              : cartItem
        );
      } else {
        nextItems = [
          ...prevItems,
          {
            ...liveItem,
            ...inventoryFields,
            id: itemId,
            menu_item_id: itemId,
            quantity: customItem
              ? 1
              : addQty,
            price: customItem
              ? 0
              : Number(
                  liveItem.price
                ) || 0,
            notes: customItem
              ? requestText
              : liveItem.notes || '',
            special_request:
              customItem
                ? requestText
                : liveItem.special_request ||
                  '',
            inventory_type:
              customItem
                ? 'custom'
                : liveItem.inventory_type,
          },
        ];
      }

      cartItemsRef.current =
        nextItems;

      return nextItems;
    });

    if (alreadyAddedCustom) {
      Alert.alert(
        'Already Added',
        'Chef Oppa Special can only be added once per order.'
      );

      return false;
    }

    if (limitReached) {
      Alert.alert(
        'Limited Stock',
        getQuantityLimitMessage(
          orderableItem
        ) ||
          `You can only order up to ${allowedQuantity} of this item today.`
      );

      return false;
    }

    return true;
  };

  const incrementQuantity = (id) => {
    const normalizedId =
      id == null ? null : String(id);

    if (!normalizedId) {
      return false;
    }

    let limitReached = false;
    let invalidInventory = false;
    let limitItem = null;

    setCartItems((prevItems) => {
      const existingItem =
        prevItems.find(
          (item) =>
            getItemId(item) ===
            normalizedId
        );

      if (!existingItem) {
        return prevItems;
      }

      const enrichedItem =
        resolveLiveItem(
          existingItem
        );

      if (isCustomItem(enrichedItem)) {
        return prevItems;
      }

      const currentQty =
        Number(
          existingItem.quantity
        ) || 0;

      if (
        !isValidDailyInventoryMenuItem(
          enrichedItem
        )
      ) {
        invalidInventory = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      const allowedQuantity =
        getAllowedOrderQuantity(
          enrichedItem
        );

      if (
        isOutOfStock(enrichedItem) ||
        allowedQuantity <= 0
      ) {
        limitReached = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      if (
        currentQty + 1 >
          allowedQuantity ||
        !canIncreaseQuantity(
          enrichedItem,
          currentQty,
          1
        )
      ) {
        limitReached = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      const nextItems =
        prevItems.map((item) =>
          getItemId(item) ===
          normalizedId
            ? {
                ...enrichedItem,
                quantity:
                  currentQty + 1,
              }
            : item
        );

      cartItemsRef.current =
        nextItems;

      return nextItems;
    });

    if (invalidInventory) {
      Alert.alert(
        'Unavailable',
        getDailyInventoryMessage(
          limitItem
        )
      );

      return false;
    }

    if (limitReached) {
      Alert.alert(
        'Limited Stock',
        getQuantityLimitMessage(
          limitItem ||
            { max_order_quantity: 0 }
        )
      );

      return false;
    }

    return true;
  };

  const removeFromCart = (id) => {
    const normalizedId =
      id == null ? null : String(id);

    if (!normalizedId) {
      return;
    }

    setCartItems((prevItems) => {
      const nextItems =
        prevItems.filter(
          (item) =>
            getItemId(item) !==
            normalizedId
        );

      cartItemsRef.current =
        nextItems;

      return nextItems;
    });
  };

  const updateQuantity = (
    id,
    quantity
  ) => {
    const normalizedId =
      id == null ? null : String(id);

    const nextQty =
      Number(quantity);

    if (
      !normalizedId ||
      !Number.isFinite(nextQty)
    ) {
      return false;
    }

    let limitReached = false;
    let invalidInventory = false;
    let limitItem = null;

    setCartItems((prevItems) => {
      const existingItem =
        prevItems.find(
          (item) =>
            getItemId(item) ===
            normalizedId
        );

      if (!existingItem) {
        return prevItems;
      }

      if (nextQty <= 0) {
        const nextItems =
          prevItems.filter(
            (item) =>
              getItemId(item) !==
              normalizedId
          );

        cartItemsRef.current =
          nextItems;

        return nextItems;
      }

      const enrichedItem =
        resolveLiveItem(
          existingItem
        );

      if (isCustomItem(enrichedItem)) {
        const nextItems =
          prevItems.map((item) =>
            getItemId(item) ===
            normalizedId
              ? {
                  ...enrichedItem,
                  quantity: 1,
                  price: 0,
                  inventory_type:
                    'custom',
                }
              : item
          );

        cartItemsRef.current =
          nextItems;

        return nextItems;
      }

      if (
        !isValidDailyInventoryMenuItem(
          enrichedItem
        )
      ) {
        invalidInventory = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      const allowedQuantity =
        getAllowedOrderQuantity(
          enrichedItem
        );

      if (
        isOutOfStock(enrichedItem) ||
        allowedQuantity <= 0 ||
        nextQty > allowedQuantity
      ) {
        limitReached = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      const nextItems =
        prevItems.map((item) =>
          getItemId(item) ===
          normalizedId
            ? {
                ...enrichedItem,
                quantity: nextQty,
              }
            : item
        );

      cartItemsRef.current =
        nextItems;

      return nextItems;
    });

    if (invalidInventory) {
      Alert.alert(
        'Unavailable',
        getDailyInventoryMessage(
          limitItem
        )
      );

      return false;
    }

    if (limitReached) {
      Alert.alert(
        'Limited Stock',
        getQuantityLimitMessage(
          limitItem ||
            { max_order_quantity: 0 }
        )
      );

      return false;
    }

    return true;
  };

  const getCartItems = () =>
    cartItemsRef.current;

  const validateCurrentCart = () => {
    const baseValidation =
      validateCartInventory(
        cartItemsRef.current,
        inventoryRef.current
      );

    if (!baseValidation.valid) {
      return baseValidation;
    }

    return validateDailyInventoryCartItems(
      cartItemsRef.current
    );
  };

  const clearCart = () => {
    cartItemsRef.current = [];
    setCartItems([]);
  };

  const clearActiveOrder = () =>
    setActiveOrderId(null);

  const cartTotal =
    cartItems.reduce(
      (total, item) => {
        if (isCustomItem(item)) {
          return total;
        }

        const price =
          Number(item.price);

        const qty =
          Number(item.quantity);

        if (
          !Number.isFinite(price) ||
          !Number.isFinite(qty)
        ) {
          return total;
        }

        return total + price * qty;
      },
      0
    );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        incrementQuantity,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        syncMenuInventory,
        mergeInventoryItems,
        refreshCartInventory,
        getCartItems,
        getEnrichedItem,
        validateCurrentCart,
        validateCartInventory:
          validateCurrentCart,

        activeOrderId,
        setActiveOrderId,
        clearActiveOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};