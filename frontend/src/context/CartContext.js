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
} from '../utils/inventory';

const CartContext = createContext();

export const useCart = () =>
  useContext(CartContext);

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
      getMaxOrderQuantity(cartItem),
  };

  const max =
    getMaxOrderQuantity(merged);
  const quantity =
    Number(cartItem.quantity) || 0;

  if (
    max !== null &&
    quantity > max
  ) {
    return {
      ...merged,
      quantity: max,
    };
  }

  return merged;
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
    cartItemsRef.current = cartItems;
  }, [cartItems]);

  useEffect(() => {
    inventoryRef.current =
      inventoryByItemId;
  }, [inventoryByItemId]);

  const applyMenuInventory = useCallback(
    (menuItems = []) => {
      const inventoryMap =
        buildInventoryMap(menuItems);

      inventoryRef.current =
        inventoryMap;

      setInventoryByItemId(
        inventoryMap
      );

      let clamped = false;

      setCartItems((prevItems) => {
        const nextItems =
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
                beforeQty !== afterQty
              ) {
                clamped = true;
              }

              return updated;
            }
          );

        cartItemsRef.current =
          nextItems;

        return nextItems;
      });

      return {
        inventoryMap,
        clamped,
      };
    },
    []
  );

  const syncMenuInventory = useCallback(
    (menuItems = []) => {
      const result =
        applyMenuInventory(
          menuItems
        );

      if (result.clamped) {
        Alert.alert(
          'Limited Stock',
          'Some items in your cart were adjusted to match current inventory.'
        );
      }
    },
    [applyMenuInventory]
  );

  const mergeInventoryItems = useCallback(
    (menuItems = []) => {
      if (
        !Array.isArray(menuItems) ||
        menuItems.length === 0
      ) {
        return;
      }

      const mergedMap = {
        ...inventoryRef.current,
        ...buildInventoryMap(menuItems),
      };

      inventoryRef.current =
        mergedMap;

      setInventoryByItemId(mergedMap);

      let clamped = false;

      setCartItems((prevItems) => {
        const nextItems =
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
                beforeQty !== afterQty
              ) {
                clamped = true;
              }

              return updated;
            }
          );

        cartItemsRef.current =
          nextItems;

        return nextItems;
      });

      if (clamped) {
        Alert.alert(
          'Limited Stock',
          'Some items in your cart were adjusted to match current inventory.'
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
        return validateCartInventory(
          cartItemsRef.current,
          inventoryRef.current
        );
      }

      applyMenuInventory(
        response.data
      );

      return validateCartInventory(
        cartItemsRef.current,
        inventoryRef.current
      );
    }, [applyMenuInventory]);

  const resolveLiveItem = useCallback(
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

  const getEnrichedItem = useCallback(
    (item) =>
      resolveLiveItem(
        enrichCartItem(
          item,
          inventoryRef.current
        )
      ),
    [resolveLiveItem, inventoryByItemId]
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

    const max =
      getMaxOrderQuantity(
        orderableItem
      );

    if (max === null) {
      Alert.alert(
        'Inventory Error',
        'Unable to verify inventory for this item.'
      );

      return false;
    }

    let limitReached = false;

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
        !canIncreaseQuantity(
          enrichedExisting,
          currentQty,
          addQty
        )
      ) {
        limitReached = true;
        return prevItems;
      }

      const nextQty =
        currentQty + addQty;

      let nextItems;

      if (existing) {
        nextItems = prevItems.map(
          (cartItem) =>
            getItemId(cartItem) ===
            itemId
              ? {
                  ...cartItem,
                  ...inventoryFields,
                  id: itemId,
                  menu_item_id: itemId,
                  quantity: nextQty,
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
            quantity: addQty,
          },
        ];
      }

      cartItemsRef.current =
        nextItems;

      return nextItems;
    });

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

      const currentQty =
        Number(
          existingItem.quantity
        ) || 0;

      if (
        isOutOfStock(enrichedItem)
      ) {
        limitReached = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      if (
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

    return !limitReached;
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

    const nextQty = Number(quantity);

    if (
      !normalizedId ||
      !Number.isFinite(nextQty)
    ) {
      return false;
    }

    let limitReached = false;
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

      if (isOutOfStock(enrichedItem)) {
        limitReached = true;
        limitItem = enrichedItem;
        return prevItems;
      }

      const max =
        getMaxOrderQuantity(
          enrichedItem
        );

      if (
        max === null ||
        nextQty > max
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

  const validateCurrentCart = () =>
    validateCartInventory(
      cartItemsRef.current,
      inventoryRef.current
    );

  const clearCart = () => {
    cartItemsRef.current = [];
    setCartItems([]);
  };

  const clearActiveOrder = () =>
    setActiveOrderId(null);

  const cartTotal =
    cartItems.reduce(
      (total, item) => {
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
