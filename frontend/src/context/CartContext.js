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
  isItemOrderable,
  isOutOfStock,
  validateCartInventory,
  pickInventoryFields,
  buildInventoryMap,
  enrichCartItem,
  isCustomItem,
  isValidIngredientInventoryMenuItem,
  getAvailabilityDisplayText,
} from '../utils/inventory';

const CartContext =
  createContext();

export const useCart = () =>
  useContext(CartContext);

const toNumberOrZero = (value) => {
  const numberValue =
    Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
};

const getMobileMaxQuantity = (item) => {
  if (!item) {
    return 0;
  }

  if (isCustomItem(item)) {
    return 1;
  }

  const quantity =
    Number(
      item?.max_order_quantity ??
        item?.remaining_today ??
        item?.available_quantity ??
        0
    );

  return Number.isFinite(quantity)
    ? Math.max(0, quantity)
    : 0;
};

const isValidIngredientItem = (item) => {
  return isValidIngredientInventoryMenuItem(
    item
  );
};

// Compatibility wrapper para hindi masira existing calls
const isValidDailyInventoryMenuItem = (item) => {
  return isValidIngredientItem(item);
};

const getInventoryMessage = (item) => {
  if (!item) {
    return 'This item is currently unavailable.';
  }

  if (isCustomItem(item)) {
    return 'Chef Oppa Special request is available.';
  }

  return (
    item?.unavailable_reason ||
    getAvailabilityDisplayText(item) ||
    'This item is currently unavailable based on ingredient stock.'
  );
};

const getQuantityLimitMessage = (
  item
) => {
  const maxQuantity =
    getMobileMaxQuantity(item);

  if (maxQuantity <= 0) {
    return (
      item?.unavailable_reason ||
      'This item is currently out of stock.'
    );
  }

  return `You can only order up to ${maxQuantity} of this item.`;
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
      cartItem.max_order_quantity ??
      null,

    remaining_today:
      menuInventory.remaining_today ??
      cartItem.remaining_today ??
      null,

    available_quantity:
      menuInventory.available_quantity ??
      cartItem.available_quantity ??
      null,

    inventory_type:
      menuInventory.inventory_type ??
      cartItem.inventory_type ??
      'ingredient',

    is_available:
      menuInventory.is_available ??
      cartItem.is_available,

    stock_label:
      menuInventory.stock_label ??
      cartItem.stock_label ??
      null,

    unavailable_reason:
      menuInventory.unavailable_reason ??
      cartItem.unavailable_reason ??
      null,
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
      is_available: true,
      max_order_quantity: 1,
      remaining_today: 1,
      available_quantity: 1,
    };
  }

  const maxQuantity =
    getMobileMaxQuantity(merged);

  const quantity =
    Number(cartItem.quantity) || 0;

  if (maxQuantity <= 0) {
    return {
      ...merged,
      quantity: 0,
    };
  }

  if (quantity > maxQuantity) {
    return {
      ...merged,
      quantity: maxQuantity,
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
        isValidIngredientItem(item)
      );
    });
  };

const validateIngredientCartItems =
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
        !isValidIngredientItem(
          cartItem
        )
      ) {
        return {
          valid: false,
          message:
            `${cartItem?.name || 'An item'} is no longer available based on ingredient stock.`,
        };
      }

      const maxQuantity =
        getMobileMaxQuantity(cartItem);

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
                isValidIngredientItem
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
              ? 'Some items in your cart were removed because they are no longer available based on ingredient stock.'
              : 'Some items in your cart were adjusted to match current ingredient stock.'
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
            isValidIngredientItem
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
              ? 'Some items in your cart were removed because they are no longer available based on ingredient stock.'
              : 'Some items in your cart were adjusted to match current ingredient stock.'
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

        return validateIngredientCartItems(
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

      return validateIngredientCartItems(
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
      inventory_type:
        isCustomItem(liveItem)
          ? 'custom'
          : liveItem?.inventory_type ||
            inventoryFields?.inventory_type ||
            'ingredient',
    };

    const customItem =
      isCustomItem(orderableItem);

    if (
      !isValidIngredientItem(
        orderableItem
      )
    ) {
      Alert.alert(
        'Unavailable',
        getInventoryMessage(
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
        getInventoryMessage(
          orderableItem
        ) ||
          'This item is currently out of stock.'
      );

      return false;
    }

    const maxQuantity =
      getMobileMaxQuantity(
        orderableItem
      );

    if (
      maxQuantity <= 0 &&
      !customItem
    ) {
      Alert.alert(
        'Out of Stock',
        getInventoryMessage(
          orderableItem
        )
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

      if (
        customItem &&
        currentQty >= 1
      ) {
        alreadyAddedCustom = true;
        return prevItems;
      }

      if (
        !customItem &&
        currentQty + addQty >
          maxQuantity
      ) {
        limitReached = true;
        return prevItems;
      }

      const nextQty =
        customItem
          ? 1
          : Math.min(
              currentQty + addQty,
              maxQuantity
            );

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
                      : orderableItem.inventory_type ||
                        'ingredient',
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
              : Math.min(
                  addQty,
                  maxQuantity
                ),
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
                : orderableItem.inventory_type ||
                  'ingredient',
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
        )
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
        !isValidIngredientItem(
          enrichedItem
        )
      ) {
        invalidInventory = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      const maxQuantity =
        getMobileMaxQuantity(
          enrichedItem
        );

      if (
        isOutOfStock(enrichedItem) ||
        maxQuantity <= 0
      ) {
        limitReached = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      if (
        currentQty + 1 >
        maxQuantity
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
                  Math.min(
                    currentQty + 1,
                    maxQuantity
                  ),
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
        getInventoryMessage(
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
        !isValidIngredientItem(
          enrichedItem
        )
      ) {
        invalidInventory = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      const maxQuantity =
        getMobileMaxQuantity(
          enrichedItem
        );

      if (
        isOutOfStock(enrichedItem) ||
        maxQuantity <= 0 ||
        nextQty > maxQuantity
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
                  Math.min(
                    nextQty,
                    maxQuantity
                  ),
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
        getInventoryMessage(
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

    return validateIngredientCartItems(
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