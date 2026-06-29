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
  pickInventoryFields,
  buildInventoryMap,
  enrichCartItem,
  isCustomItem,
} from '../utils/inventory';

const CartContext =
  createContext();

export const useCart = () =>
  useContext(CartContext);

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

const isIngredientCustomItem = (
  item
) => {
  const category =
    normalizeText(item?.category);

  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  const name =
    normalizeText(item?.name);

  return (
    isCustomItem(item) ||
    category === 'chef oppa special' ||
    inventoryType === 'custom' ||
    name.includes(
      'custom chef oppa special'
    )
  );
};

const toNumberOrNull = (value) => {
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

const getIngredientMaxQuantity = (
  item
) => {
  if (!item) {
    return 0;
  }

  if (isIngredientCustomItem(item)) {
    return 1;
  }

  const maxOrderQuantity =
    toNumberOrNull(
      item?.max_order_quantity ??
      item?.remaining_today ??
      item?.available_quantity ??
      0
    );

  if (maxOrderQuantity === null) {
    return 0;
  }

  return Math.max(
    0,
    maxOrderQuantity
  );
};

const isIngredientItemAvailable = (
  item
) => {
  if (!item) {
    return false;
  }

  if (isIngredientCustomItem(item)) {
    return isAvailableTrue(
      item?.is_available
    );
  }

  const maxQuantity =
    getIngredientMaxQuantity(item);

  return (
    isAvailableTrue(
      item?.is_available
    ) &&
    Number.isFinite(maxQuantity) &&
    maxQuantity > 0
  );
};

const getIngredientStockLabel = (
  item
) => {
  if (!item) {
    return 'Unavailable based on ingredient stock.';
  }

  if (isIngredientCustomItem(item)) {
    return isAvailableTrue(
      item?.is_available
    )
      ? 'Custom request available'
      : item?.unavailable_reason ||
          item?.stock_label ||
          item?.daily_inventory_label ||
          'Chef Oppa Special is currently unavailable.';
  }

  if (item?.unavailable_reason) {
    return String(
      item.unavailable_reason
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

  const maxQuantity =
    getIngredientMaxQuantity(item);

  if (
    item?.is_available === true &&
    maxQuantity > 0
  ) {
    return `Only ${maxQuantity} order(s) available based on ingredient stock.`;
  }

  return 'Unavailable based on ingredient stock.';
};

const getQuantityLimitMessage = (
  item
) => {
  const maxQuantity =
    getIngredientMaxQuantity(item);

  return `You can only order up to ${maxQuantity} of this item based on ingredient stock.`;
};

const getUnavailableMessage = (
  item
) => {
  if (!item) {
    return 'This item is unavailable based on ingredient stock.';
  }

  if (item?.unavailable_reason) {
    return String(
      item.unavailable_reason
    );
  }

  if (item?.stock_label) {
    return String(item.stock_label);
  }

  if (item?.daily_inventory_label) {
    return String(
      item.daily_inventory_label
    );
  }

  if (isIngredientCustomItem(item)) {
    return `${item?.name || 'Chef Oppa Special'} is currently unavailable.`;
  }

  if (
    getIngredientMaxQuantity(item) === 0
  ) {
    return `${item?.name || 'This item'} is sold out based on ingredient stock.`;
  }

  return `${item?.name || 'This item'} is currently unavailable based on ingredient stock.`;
};

const mergeAndClampCartItem = (
  cartItem,
  menuInventory
) => {
  if (!menuInventory) {
    if (isIngredientCustomItem(cartItem)) {
      return {
        ...cartItem,
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

    return cartItem;
  }

  const merged = {
    ...cartItem,
    ...menuInventory,

    id:
      cartItem.id ||
      menuInventory.id,

    menu_item_id:
      cartItem.menu_item_id ||
      menuInventory.menu_item_id ||
      menuInventory.id,

    quantity:
      cartItem.quantity,

    max_order_quantity:
      menuInventory.max_order_quantity ??
      cartItem.max_order_quantity,

    available_quantity:
      menuInventory.available_quantity ??
      cartItem.available_quantity,

    daily_limit:
      menuInventory.daily_limit ??
      cartItem.daily_limit,

    remaining_today:
      menuInventory.remaining_today ??
      cartItem.remaining_today,

    stock_label:
      menuInventory.stock_label ??
      cartItem.stock_label,

    daily_inventory_label:
      menuInventory.daily_inventory_label ??
      cartItem.daily_inventory_label,

    unavailable_reason:
      menuInventory.unavailable_reason ??
      cartItem.unavailable_reason,

    inventory_type:
      menuInventory.inventory_type ??
      cartItem.inventory_type,

    is_available:
      menuInventory.is_available ??
      cartItem.is_available,

    ingredients:
      Array.isArray(
        menuInventory.ingredients
      )
        ? menuInventory.ingredients
        : cartItem.ingredients,
  };

  if (isIngredientCustomItem(merged)) {
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

  const maxQuantity =
    getIngredientMaxQuantity(merged);

  const quantity =
    Number(cartItem.quantity) || 0;

  if (
    !isIngredientItemAvailable(merged)
  ) {
    return {
      ...merged,
      quantity: 0,
    };
  }

  if (
    quantity > maxQuantity
  ) {
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
      if (isIngredientCustomItem(item)) {
        return isIngredientItemAvailable(item);
      }

      return (
        Number(item.quantity || 0) > 0 &&
        isIngredientItemAvailable(item)
      );
    });
  };

const validateIngredientCartItems = (
  cartItems = []
) => {
  for (const cartItem of cartItems) {
    const customItem =
      isIngredientCustomItem(cartItem);

    if (customItem) {
      if (
        !isIngredientItemAvailable(
          cartItem
        )
      ) {
        return {
          valid: false,
          message:
            getUnavailableMessage(cartItem),
        };
      }

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
      !isIngredientItemAvailable(
        cartItem
      )
    ) {
      return {
        valid: false,
        message:
          getUnavailableMessage(cartItem),
      };
    }

    const maxQuantity =
      getIngredientMaxQuantity(
        cartItem
      );

    const requestedQuantity =
      Number(cartItem.quantity || 0);

    if (requestedQuantity <= 0) {
      return {
        valid: false,
        message:
          `${cartItem?.name || 'An item'} has invalid quantity.`,
      };
    }

    if (
      requestedQuantity >
      maxQuantity
    ) {
      return {
        valid: false,
        message:
          `${cartItem?.name || 'An item'} only has ${maxQuantity} order(s) available based on ingredient stock. Please reduce the quantity.`,
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

  const normalizeMenuItemsForInventory =
    useCallback((menuItems = []) => {
      if (!Array.isArray(menuItems)) {
        return [];
      }

      return menuItems;
    }, []);

  const applyMenuInventory =
    useCallback(
      (menuItems = []) => {
        const latestMenuItems =
          normalizeMenuItemsForInventory(
            menuItems
          );

        const inventoryMap =
          buildInventoryMap(
            latestMenuItems
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
      [
        normalizeMenuItemsForInventory,
      ]
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
          normalizeMenuItemsForInventory(
            menuItems
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
      [
        normalizeMenuItemsForInventory,
      ]
    );

  const refreshCartInventory =
    useCallback(async () => {
      let response;

      try {
        response =
          await getMenu();
      } catch (error) {
        return {
          valid: false,
          message:
            'Unable to verify latest stock. Please try again.',
        };
      }

      console.log(
        'CART INVENTORY DEBUG SOURCE:',
        {
          debug_source:
            response?.debug_source,
          expected_debug_source:
            'WEB_MENU_INGREDIENT_AVAILABILITY_FIXED_2026',
          correct_backend:
            response?.debug_source ===
            'WEB_MENU_INGREDIENT_AVAILABILITY_FIXED_2026',
        }
      );

      if (
        !response?.success ||
        !Array.isArray(
          response.data
        )
      ) {
        return {
          valid: false,
          message:
            'Unable to verify latest stock. Please try again.',
        };
      }

      applyMenuInventory(
        response.data
      );

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
    };

    const customItem =
      isIngredientCustomItem(
        orderableItem
      );

    if (
      !isIngredientItemAvailable(
        orderableItem
      )
    ) {
      Alert.alert(
        'Unavailable',
        getUnavailableMessage(
          orderableItem
        )
      );

      return false;
    }

    const maxQuantity =
      getIngredientMaxQuantity(
        orderableItem
      );

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
                      : liveItem.inventory_type,
                  stock_label:
                    liveItem.stock_label ||
                    cartItem.stock_label,
                  daily_inventory_label:
                    liveItem.daily_inventory_label ||
                    cartItem.daily_inventory_label,
                  unavailable_reason:
                    liveItem.unavailable_reason ||
                    cartItem.unavailable_reason,
                  is_available:
                    liveItem.is_available,
                  max_order_quantity:
                    liveItem.max_order_quantity,
                  remaining_today:
                    liveItem.remaining_today,
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
                : liveItem.inventory_type,
            stock_label:
              liveItem.stock_label,
            daily_inventory_label:
              liveItem.daily_inventory_label,
            unavailable_reason:
              liveItem.unavailable_reason,
            is_available:
              liveItem.is_available,
            max_order_quantity:
              liveItem.max_order_quantity,
            remaining_today:
              liveItem.remaining_today,
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

      if (
        isIngredientCustomItem(
          enrichedItem
        )
      ) {
        limitReached = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      const currentQty =
        Number(
          existingItem.quantity
        ) || 0;

      if (
        !isIngredientItemAvailable(
          enrichedItem
        )
      ) {
        invalidInventory = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      const maxQuantity =
        getIngredientMaxQuantity(
          enrichedItem
        );

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
        getUnavailableMessage(
          limitItem
        )
      );

      return false;
    }

    if (limitReached) {
      Alert.alert(
        'Limited Stock',
        isIngredientCustomItem(limitItem)
          ? 'Chef Oppa Special requests can only have quantity of 1.'
          : getQuantityLimitMessage(
              limitItem ||
                {}
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

      if (
        isIngredientCustomItem(
          enrichedItem
        )
      ) {
        if (nextQty !== 1) {
          limitReached = true;
          limitItem = enrichedItem;
        }

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
        !isIngredientItemAvailable(
          enrichedItem
        )
      ) {
        invalidInventory = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      const maxQuantity =
        getIngredientMaxQuantity(
          enrichedItem
        );

      if (
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
        getUnavailableMessage(
          limitItem
        )
      );

      return false;
    }

    if (limitReached) {
      Alert.alert(
        'Limited Stock',
        isIngredientCustomItem(limitItem)
          ? 'Chef Oppa Special requests can only have quantity of 1.'
          : getQuantityLimitMessage(
              limitItem ||
                {}
            )
      );

      return false;
    }

    return true;
  };

  const getCartItems = () =>
    cartItemsRef.current;

  const validateCurrentCart = () => {
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
        if (
          isIngredientCustomItem(item)
        ) {
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
        getIngredientMaxQuantity,
        getIngredientStockLabel,
        isIngredientItemAvailable,

        activeOrderId,
        setActiveOrderId,
        clearActiveOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};