import React, {
  createContext,
  useState,
  useContext,
} from 'react';

import { Alert } from 'react-native';

const CartContext = createContext();

export const useCart = () =>
  useContext(CartContext);

export const CartProvider = ({
  children,
}) => {
  const [cartItems, setCartItems] =
    useState([]);

  const [
    activeOrderId,
    setActiveOrderId,
  ] = useState(null);

  const getItemId = (item) => {
    return (
      item?.id ||
      item?.menu_item_id
    );
  };

  const getStock = (item) => {
    return (
      Number(item?.available_quantity) ||
      Number(item?.stock) ||
      Number(item?.inventory) ||
      Number(item?.available_stock) ||
      Number(item?.current_stock) ||
      0
    );
  };

  const isItemAvailable = (item) => {
    const stock = getStock(item);

    const manuallyAvailable =
      item?.is_available === true ||
      item?.is_available === 1 ||
      item?.is_available === 'true';

    return manuallyAvailable && stock > 0;
  };

  const addToCart = (item) => {
    const stock = getStock(item);
    const itemId = getItemId(item);

    if (!itemId) {
      Alert.alert(
        'Item Error',
        'This item has no valid menu item ID.'
      );

      return;
    }

    if (!isItemAvailable(item)) {
      Alert.alert(
        'Not Available',
        'This item is currently not available.'
      );

      return;
    }

    setCartItems((prevItems) => {
      const existingItem =
        prevItems.find(
          (i) =>
            getItemId(i) === itemId
        );

      if (existingItem) {
        if (
          existingItem.quantity >=
          stock
        ) {
          Alert.alert(
            'Insufficient Stock',
            'You cannot add more of this item because it has limited availability.'
          );

          return prevItems;
        }

        return prevItems.map((i) =>
          getItemId(i) === itemId
            ? {
                ...i,
                quantity:
                  i.quantity + 1,
              }
            : i
        );
      }

      return [
        ...prevItems,
        {
          ...item,
          id: itemId,
          menu_item_id: itemId,
          quantity: 1,
        },
      ];
    });
  };

  const removeFromCart = (id) => {
    setCartItems((prevItems) =>
      prevItems.filter(
        (item) =>
          getItemId(item) !== id
      )
    );
  };

  const updateQuantity = (
    id,
    quantity
  ) => {
    setCartItems((prevItems) => {
      const existingItem =
        prevItems.find(
          (item) =>
            getItemId(item) === id
        );

      if (!existingItem) {
        return prevItems;
      }

      if (quantity <= 0) {
        return prevItems.filter(
          (item) =>
            getItemId(item) !== id
        );
      }

      const stock =
        getStock(existingItem);

      if (quantity > stock) {
        Alert.alert(
          'Insufficient Stock',
          'You cannot add more of this item because it has limited availability.'
        );

        return prevItems;
      }

      return prevItems.map((item) =>
        getItemId(item) === id
          ? {
              ...item,
              quantity,
            }
          : item
      );
    });
  };

  const clearCart = () =>
    setCartItems([]);

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
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,

        activeOrderId,
        setActiveOrderId,
        clearActiveOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};