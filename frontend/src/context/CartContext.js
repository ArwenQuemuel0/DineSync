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

  const getStock = (item) => {
    return (
      Number(item.available_quantity) ||
      Number(item.stock) ||
      Number(item.inventory) ||
      Number(item.available_stock) ||
      Number(item.current_stock) ||
      0
    );
  };

  const addToCart = (item) => {
    const stock = getStock(item);

    if (stock <= 0) {
      Alert.alert(
        'Not Available',
        'This item is currently not available.'
      );

      return;
    }

    setCartItems((prevItems) => {
      const existingItem =
        prevItems.find(
          (i) => i.id === item.id
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
          i.id === item.id
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
          quantity: 1,
        },
      ];
    });
  };

  const removeFromCart = (id) => {
    setCartItems((prevItems) =>
      prevItems.filter(
        (item) => item.id !== id
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
          (item) => item.id === id
        );

      if (!existingItem) {
        return prevItems;
      }

      if (quantity <= 0) {
        return prevItems.filter(
          (item) => item.id !== id
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
        item.id === id
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
        const price = Number(
          item.price
        );

        const qty = Number(
          item.quantity
        );

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