import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  CommonActions,
} from '@react-navigation/native';

import {
  placeOrder,
  extractApiErrorMessage,
  validateCartAgainstLatestMenu,
} from '../api/dinesync';

import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTableStatus } from '../context/TableStatusContext';
import { TABLE_ASSIGNMENT_MESSAGE } from '../constants/tableStatus';

import {
  getItemId,
  isCustomItem,
  isValidIngredientInventoryMenuItem,
  getAvailabilityDisplayText,
} from '../utils/inventory';

const toNumber = (value) => {
  const numberValue =
    Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
};

const getRemainingToday = (item) => {
  if (!item) {
    return 0;
  }

  if (isCustomItem(item)) {
    return 1;
  }

  return toNumber(
    item?.remaining_today ??
      item?.available_quantity ??
      item?.max_order_quantity ??
      0
  );
};

const getMaxOrderQuantity = (item) => {
  if (!item) {
    return 0;
  }

  if (isCustomItem(item)) {
    return 1;
  }

  return toNumber(
    item?.max_order_quantity ??
      item?.remaining_today ??
      item?.available_quantity ??
      0
  );
};

const getAllowedOrderQuantity = (item) => {
  if (!item) {
    return 0;
  }

  if (isCustomItem(item)) {
    return 1;
  }

  const maxOrderQuantity =
    getMaxOrderQuantity(item);

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

const isValidOrderInventoryItem = (item) => {
  return isValidIngredientInventoryMenuItem(
    item
  );
};

// Compatibility wrapper para hindi masira existing calls
const isValidDailyInventoryMenuItem = (item) => {
  return isValidOrderInventoryItem(item);
};

const isIngredientCustomItem = (item) => {
  return isCustomItem(item);
};

const validateIngredientCartItems = (
  cartItems = [],
  getEnrichedItem
) => {
  for (const cartItem of cartItems) {
    const item =
      typeof getEnrichedItem === 'function'
        ? getEnrichedItem(cartItem)
        : cartItem;

    const customItem =
      isIngredientCustomItem(item);

    const quantity =
      customItem
        ? Number(cartItem.quantity || 1)
        : Number(cartItem.quantity || 0);

    if (customItem) {
      if (quantity !== 1) {
        return {
          valid: false,
          message:
            'Chef Oppa Special requests must have quantity of 1 only.',
        };
      }

      continue;
    }

    if (
      !isValidOrderInventoryItem(item)
    ) {
      return {
        valid: false,
        message:
          `${item?.name || cartItem?.name || 'An item'} is no longer available based on ingredient stock.`,
      };
    }

    const maxQuantity =
      getMaxOrderQuantity(item);

    const allowedQuantity =
      getAllowedOrderQuantity(item);

    if (quantity <= 0) {
      return {
        valid: false,
        message:
          `${item?.name || cartItem?.name || 'An item'} is currently out of stock.`,
      };
    }

    if (
      maxQuantity !== null &&
      quantity > maxQuantity
    ) {
      return {
        valid: false,
        message:
          `${item?.name || cartItem?.name || 'An item'} only has ${allowedQuantity} available based on ingredient stock.`,
      };
    }
  }

  return {
    valid: true,
    message: '',
  };
};

export default function OrderConfirmScreen({
  route,
  navigation,
}) {
  const {
    cartItems: routeCartItems = [],
    total: routeTotal = 0,
    tableNumber: routeTableNumber,
  } = route.params || {};

  const {
    width,
    height,
  } = useWindowDimensions();

  const insets =
    useSafeAreaInsets();

  const responsive =
    useMemo(() => {
      const shortest =
        Math.min(width, height);

      const longest =
        Math.max(width, height);

      const isLandscape =
        width > height;

      const isPhone =
        shortest < 600;

      const isVeryNarrow =
        width < 390;

      const isShortLandscape =
        isLandscape &&
        height < 430;

      const usableWidth =
        width -
        insets.left -
        insets.right;

      const usableHeight =
        height -
        insets.top -
        insets.bottom;

      const clamp = (
        value,
        min,
        max
      ) => {
        return Math.max(
          min,
          Math.min(value, max)
        );
      };

      const base =
        isPhone
          ? Math.min(shortest / 390, 1)
          : Math.min(shortest / 768, 1.05);

      const scale = (
        size,
        min = size * 0.72,
        max = size * 1.12
      ) => {
        return Math.round(
          clamp(size * base, min, max)
        );
      };

      const useTwoPane =
        isLandscape &&
        usableWidth >= 720 &&
        usableHeight >= 330;

      const screenPadding =
        useTwoPane
          ? scale(12, 8, 14)
          : isVeryNarrow
            ? scale(12, 10, 14)
            : isPhone
              ? scale(14, 12, 16)
              : scale(22, 16, 24);

      const receiptItemsMaxHeight =
        useTwoPane
          ? isShortLandscape
            ? clamp(usableHeight * 0.26, 88, 118)
            : clamp(usableHeight * 0.34, 125, 220)
          : isPhone
            ? clamp(usableHeight * 0.32, 185, 285)
            : clamp(usableHeight * 0.34, 220, 360);

      const optionMaxHeight =
        useTwoPane
          ? clamp(usableHeight * 0.76, 235, 520)
          : undefined;

      return {
        isPhone,
        isVeryNarrow,
        isLandscape,
        isShortLandscape,
        useTwoPane,

        safeTopExtra: 0,

        safeBottomExtra:
          Math.max(
            insets.bottom +
            (Platform.OS === 'android' ? 10 : 8),
            16
          ),

        containerPadding:
          screenPadding,

        topBarHeight:
          useTwoPane
            ? scale(44, 38, 48)
            : isPhone
              ? scale(52, 46, 56)
              : scale(60, 50, 64),

        backText:
          useTwoPane
            ? scale(15, 13, 16)
            : isPhone
              ? scale(17, 15, 18)
              : scale(24, 17, 24),

        tableText:
          useTwoPane
            ? scale(15, 13, 16)
            : isPhone
              ? scale(17, 15, 18)
              : scale(24, 17, 24),

        header:
          useTwoPane
            ? scale(28, 24, 30)
            : isVeryNarrow
              ? scale(30, 26, 32)
              : isPhone
                ? scale(34, 28, 36)
                : scale(46, 32, 48),

        subHeader:
          useTwoPane
            ? scale(12, 10, 13)
            : isPhone
              ? scale(14, 12, 15)
              : scale(18, 14, 18),

        subHeaderMargin:
          useTwoPane
            ? scale(8, 6, 10)
            : isPhone
              ? scale(12, 10, 14)
              : scale(18, 14, 20),

        contentGap:
          useTwoPane
            ? scale(10, 8, 12)
            : isPhone
              ? scale(14, 12, 16)
              : scale(18, 12, 20),

        cardPadding:
          useTwoPane
            ? scale(12, 9, 14)
            : isVeryNarrow
              ? scale(14, 12, 15)
              : isPhone
                ? scale(16, 13, 18)
                : scale(22, 16, 24),

        cardRadius:
          scale(22, 16, 24),

        receiptTitle:
          useTwoPane
            ? scale(21, 18, 22)
            : isPhone
              ? scale(23, 20, 24)
              : scale(30, 22, 30),

        receiptTable:
          useTwoPane
            ? scale(13, 11, 14)
            : scale(18, 13, 18),

        dividerMargin:
          useTwoPane
            ? scale(8, 6, 10)
            : isPhone
              ? scale(12, 9, 13)
              : scale(16, 10, 16),

        itemName:
          useTwoPane
            ? scale(13, 11, 14)
            : isPhone
              ? scale(16, 14, 18)
              : scale(19, 14, 19),

        itemUnit:
          useTwoPane
            ? scale(11, 9, 12)
            : isPhone
              ? scale(13, 11, 14)
              : scale(14, 11, 14),

        itemSubtotal:
          useTwoPane
            ? scale(13, 11, 14)
            : isPhone
              ? scale(16, 13, 18)
              : scale(18, 13, 18),

        requestText:
          useTwoPane
            ? scale(11, 9, 12)
            : scale(14, 11, 14),

        qtyButton:
          useTwoPane
            ? scale(26, 22, 28)
            : isPhone
              ? scale(30, 26, 34)
              : scale(32, 26, 34),

        qtyText:
          useTwoPane
            ? scale(14, 12, 15)
            : scale(17, 14, 18),

        removeText:
          useTwoPane
            ? scale(17, 14, 18)
            : scale(20, 16, 22),

        summaryLabel:
          useTwoPane
            ? scale(13, 11, 14)
            : scale(18, 14, 18),

        summaryValue:
          useTwoPane
            ? scale(14, 12, 15)
            : scale(20, 15, 20),

        totalLabel:
          useTwoPane
            ? scale(16, 13, 17)
            : isPhone
              ? scale(18, 16, 19)
              : scale(23, 17, 23),

        totalValue:
          useTwoPane
            ? scale(20, 16, 21)
            : isPhone
              ? scale(23, 20, 24)
              : scale(28, 22, 28),

        noticeText:
          useTwoPane
            ? scale(11, 9, 12)
            : scale(14, 11, 14),

        optionTitle:
          useTwoPane
            ? scale(20, 16, 21)
            : isPhone
              ? scale(21, 18, 22)
              : scale(26, 20, 26),

        paymentTitle:
          useTwoPane
            ? scale(15, 12, 16)
            : scale(20, 15, 20),

        paymentDesc:
          useTwoPane
            ? scale(11, 9, 12)
            : scale(14, 11, 14),

        disclaimerTitle:
          useTwoPane
            ? scale(13, 11, 14)
            : scale(18, 14, 18),

        disclaimerText:
          useTwoPane
            ? scale(11, 9, 12)
            : scale(15, 12, 15),

        buttonText:
          useTwoPane
            ? scale(16, 13, 17)
            : isPhone
              ? scale(18, 16, 20)
              : scale(20, 15, 20),

        buttonPadding:
          useTwoPane
            ? scale(10, 8, 11)
            : scale(16, 12, 16),

        maxContentWidth:
          clamp(longest * 0.96, 340, 1400),

        receiptItemsMaxHeight,
        optionMaxHeight,
      };
    }, [
      width,
      height,
      insets.top,
      insets.left,
      insets.right,
      insets.bottom,
    ]);

  const {
    tableNumber,
    user,
  } = useAuth();

  const {
    cartItems: contextCartItems,
    cartTotal,
    clearCart,
    setActiveOrderId,
    refreshCartInventory,
    getEnrichedItem,
    updateQuantity,
    incrementQuantity,
    removeFromCart,
  } = useCart();

  const {
    ensureCanOrder,
    assignmentMessage,
    tableResetRequired,
    acknowledgeTableReset,
  } = useTableStatus();

  const finalTableNumber =
    routeTableNumber ||
    tableNumber ||
    user?.table_number;

  const cartItems =
    contextCartItems.length > 0
      ? contextCartItems
      : routeCartItems;

  const total =
    contextCartItems.length > 0
      ? cartTotal
      : routeTotal;

  const hasCustomRequest =
    useMemo(() => {
      return cartItems.some((item) => {
        const enrichedItem =
          getEnrichedItem
            ? getEnrichedItem(item)
            : item;

        return isIngredientCustomItem(enrichedItem);
      });
    }, [
      cartItems,
      getEnrichedItem,
    ]);

  const [selectedPayment, setSelectedPayment] =
    useState('Pay Later');

  const [loading, setLoading] =
    useState(false);

  const paymentOptions =
    useMemo(() => {
      return [
        {
          label: 'Pay Later',
          apiMethod: 'Pay Later',
          description:
            'Send your order to the kitchen now and settle payment later with staff.',
          disabled: false,
        },
        {
          label: 'Pay at Counter',
          apiMethod: 'Pay at Counter',
          description:
            'Pay first at the cashier before your order is sent to the kitchen.',
          disabled: false,
        },
        {
          label: 'QR PH',
          apiMethod: 'Digital Payment',
          description:
            hasCustomRequest
              ? 'Not available for Chef Oppa Special requests because the price must be confirmed by staff.'
              : 'Pay securely through Xendit QR PH checkout.',
          disabled: hasCustomRequest,
        },
      ];
    }, [
      hasCustomRequest,
    ]);

  useEffect(() => {
    if (!tableResetRequired) {
      return;
    }

    acknowledgeTableReset?.();

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'Welcome',
          },
        ],
      })
    );
  }, [
    tableResetRequired,
    acknowledgeTableReset,
    navigation,
  ]);

  useEffect(() => {
    if (
      hasCustomRequest &&
      selectedPayment === 'QR PH'
    ) {
      setSelectedPayment('Pay Later');
    }
  }, [
    hasCustomRequest,
    selectedPayment,
  ]);

  const totalItems =
    useMemo(() => {
      return cartItems.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0),
        0
      );
    }, [cartItems]);

  const formatMoney = (value) => {
    const n = Number(value);

    return Number.isFinite(n)
      ? n.toFixed(2)
      : '0.00';
  };

  const getConfirmationMessage = (
    method
  ) => {
    if (method === 'Pay Later') {
      return 'Order sent to kitchen. Please settle payment later with staff.';
    }

    if (method === 'Pay at Counter') {
      return 'Order recorded. Please proceed to the counter to pay before the kitchen prepares your order.';
    }

    return 'Opening Xendit QR PH checkout. Your order will be sent to the kitchen after payment is confirmed.';
  };

  const getConfirmDialogMessage = (
    method
  ) => {
    if (method === 'Pay Later') {
      return 'Please review your order carefully. Once confirmed, your order will be sent to the kitchen and can no longer be cancelled or changed.';
    }

    if (method === 'Pay at Counter') {
      return 'Please review your order carefully. Once confirmed, your order will be recorded first. Please pay at the counter before the kitchen prepares your order.';
    }

    return 'Please review your order carefully. Once confirmed, your order will be recorded first and Xendit QR PH checkout will open. The kitchen will receive your order after payment is confirmed.';
  };

  const handleSelectPayment = (option) => {
    if (option.disabled) {
      Alert.alert(
        'QR PH Not Available',
        'Chef Oppa Special requests must be confirmed by staff. QR PH payment is not available for custom requests.'
      );

      return;
    }

    setSelectedPayment(option.label);
  };

  const getSafeSelectedOption = () => {
    const option =
      paymentOptions.find(
        (item) =>
          item.label === selectedPayment
      ) || paymentOptions[0];

    if (
      option.disabled ||
      (
        hasCustomRequest &&
        option.label === 'QR PH'
      )
    ) {
      return paymentOptions[0];
    }

    return option;
  };

  const validateBeforeConfirm = async () => {
    const inventoryCheck =
      await refreshCartInventory();

    if (!inventoryCheck.valid) {
      return inventoryCheck;
    }

    return validateIngredientCartItems(
      cartItems,
      getEnrichedItem
    );
  };

  const handleIncreaseItem = (item) => {
    const enrichedItem =
      getEnrichedItem
        ? getEnrichedItem(item)
        : item;

    const customItem =
      isIngredientCustomItem(enrichedItem);

    if (customItem) {
      Alert.alert(
        'Chef Oppa Special',
        'Chef Oppa Special requests can only have quantity of 1.'
      );

      return;
    }

    if (
      !isValidOrderInventoryItem(
        enrichedItem
      )
    ) {
      Alert.alert(
        'Unavailable',
        getAvailabilityDisplayText(enrichedItem) ||
          `${item?.name || 'This item'} is no longer available based on ingredient stock.`
      );

      return;
    }

    const allowedQuantity =
      getMaxOrderQuantity(
        enrichedItem
      );

    const currentQuantity =
      Number(item.quantity || 0);

    if (
      allowedQuantity !== null &&
      (
        allowedQuantity <= 0 ||
        currentQuantity >= allowedQuantity
      )
    ) {
      Alert.alert(
        'Limited Stock',
        `You can only order up to ${allowedQuantity} of this item.`
      );

      return;
    }

    incrementQuantity(
      getItemId(item)
    );
  };

  const handleDecreaseItem = (item) => {
    const itemId =
      getItemId(item);

    const quantity =
      Number(item.quantity || 0);

    if (quantity <= 1) {
      removeFromCart(itemId);
      return;
    }

    updateQuantity(
      itemId,
      quantity - 1
    );
  };

  const handleRemoveItem = (item) => {
    removeFromCart(
      getItemId(item)
    );
  };

  const goToOrderStatusWithMessage = (
    orderId,
    message
  ) => {
    Alert.alert(
      'Order Confirmed',
      message,
      [
        {
          text: 'OK',
          onPress: () => {
            navigation.replace(
              'OrderStatus',
              {
                orderId,
                message,
              }
            );
          },
        },
      ]
    );
  };

  const openPaymentWithMessage = ({
    orderId,
    invoiceUrl,
    message,
  }) => {
    Alert.alert(
      'Order Recorded',
      message,
      [
        {
          text: 'Open Checkout',
          onPress: () => {
            navigation.replace(
              'PaymentWebView',
              {
                orderId,
                invoiceUrl,
                message,
              }
            );
          },
        },
      ]
    );
  };

  const submitOrder = async (
    paymentSnapshot
  ) => {
    setLoading(true);

    try {
      const selectedPaymentOption =
        paymentSnapshot ||
        getSafeSelectedOption();

      const tableCheck =
        await ensureCanOrder();

      if (!tableCheck.allowed) {
        Alert.alert(
          'Table Not Assigned',
          tableCheck.message ||
            assignmentMessage
        );

        return;
      }

      const inventoryCheck =
        await validateBeforeConfirm();

      if (!inventoryCheck.valid) {
        Alert.alert(
          'Limited Stock',
          inventoryCheck.message ||
            'Some items are no longer available based on ingredient stock.'
        );

        return;
      }

      if (
        hasCustomRequest &&
        selectedPaymentOption.label === 'QR PH'
      ) {
        Alert.alert(
          'QR PH Not Available',
          'Chef Oppa Special requests must be confirmed by staff. QR PH payment is not available for custom requests.'
        );

        return;
      }

      console.log('SUBMIT ORDER START:', {
        cartItems,
        finalTableNumber,
        paymentMethod:
          selectedPaymentOption.apiMethod,
      });

      const orderResponse =
        await placeOrder(
          cartItems,
          finalTableNumber,
          selectedPaymentOption.apiMethod
        );

      console.log(
        'SUBMIT ORDER RESPONSE:',
        orderResponse
      );

      if (
        !orderResponse.success ||
        !orderResponse.data
      ) {
        Alert.alert(
          'Order Failed',
          orderResponse.message ||
            'Unable to create order.'
        );

        return;
      }

      const orderId =
        orderResponse.order_id ||
        orderResponse.data.id;

      const invoiceUrl =
        orderResponse.invoice_url ||
        orderResponse.xendit_invoice_url ||
        orderResponse.data.invoice_url ||
        orderResponse.data.xendit_invoice_url;

      if (!orderId) {
        Alert.alert(
          'Order Error',
          'Order was created but no order ID was returned.'
        );

        return;
      }

      const confirmationMessage =
        getConfirmationMessage(
          selectedPaymentOption.label
        );

      clearCart();

      setActiveOrderId(orderId);

      if (
        selectedPaymentOption.label === 'QR PH'
      ) {
        if (!invoiceUrl) {
          Alert.alert(
            'Payment Error',
            'No Xendit QR PH checkout link was returned. Please ask restaurant staff for help.'
          );

          navigation.replace(
            'OrderStatus',
            {
              orderId,
              message:
                'Order recorded, but the Xendit QR PH checkout link was not returned. Please contact staff.',
            }
          );

          return;
        }

        openPaymentWithMessage({
          orderId,
          invoiceUrl,
          message:
            confirmationMessage,
        });

        return;
      }

      goToOrderStatusWithMessage(
        orderId,
        confirmationMessage
      );
    } catch (error) {
      console.error(
        'CONFIRM ORDER ERROR:',
        error
      );

      const errorMessage =
        extractApiErrorMessage(
          error,
          'Order failed. Please try again.'
        );

      const statusCode =
        error?.response?.status;

      const isAssignmentError =
        statusCode === 403 ||
        errorMessage ===
          TABLE_ASSIGNMENT_MESSAGE;

      const normalizedError =
        String(errorMessage || '')
          .trim()
          .toLowerCase();

      const isInventoryError =
        statusCode === 422 ||
        statusCode === 400 ||
        normalizedError.includes('stock') ||
        normalizedError.includes('available') ||
        normalizedError.includes('sold out') ||
        normalizedError.includes('quantity') ||
        normalizedError.includes('unavailable');

      Alert.alert(
        isAssignmentError
          ? 'Table Not Assigned'
          : isInventoryError
            ? 'Limited Stock'
            : 'Order Failed',
        errorMessage
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFinalConfirm = async () => {
    console.log('CONFIRM BUTTON PRESSED');

    if (loading) {
      return;
    }

    if (!cartItems || cartItems.length === 0) {
      Alert.alert(
        'Empty Order',
        'Please add at least one item before confirming.'
      );

      navigation.navigate('Menu');

      return;
    }

    if (!finalTableNumber) {
      Alert.alert(
        'Table Error',
        'No table number found. Please login again using the assigned table account.'
      );

      return;
    }

    const inventoryCheck =
      await validateBeforeConfirm();

    console.log(
      'CONFIRM INVENTORY CHECK:',
      inventoryCheck
    );

    if (!inventoryCheck.valid) {
      Alert.alert(
        'Limited Stock',
        inventoryCheck.message ||
          'Some items are no longer available based on ingredient stock.'
      );

      return;
    }

    const paymentSnapshot =
      getSafeSelectedOption();

    if (
      hasCustomRequest &&
      paymentSnapshot.label === 'QR PH'
    ) {
      Alert.alert(
        'QR PH Not Available',
        'Chef Oppa Special requests must be confirmed by staff. QR PH payment is not available for custom requests.'
      );

      return;
    }

    Alert.alert(
      'Confirm Order',
      getConfirmDialogMessage(
        paymentSnapshot.label
      ),
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: () =>
            submitOrder(
              paymentSnapshot
            ),
        },
      ]
    );
  };

  const renderReceiptItem = (
    item,
    index
  ) => {
    const enrichedItem =
      getEnrichedItem
        ? getEnrichedItem(item)
        : item;

    const customItem =
      isIngredientCustomItem(enrichedItem);

    const unlimited =
      enrichedItem?.is_unlimited === true;

    const quantity =
      customItem
        ? 1
        : Number(item.quantity || 0);

    const price =
      customItem
        ? 0
        : Number(item.price || 0);

    const subtotal =
      quantity * price;

    const requestText =
      item.special_request ||
      item.notes ||
      '';

    const itemKey =
      String(
        getItemId(item) ||
          item.menu_item_id ||
          item.id ||
          index
      );

    const allowedQuantity =
      customItem
        ? 1
        : getMaxOrderQuantity(
            enrichedItem
          );

    const invalidStock =
      !customItem &&
      !isValidOrderInventoryItem(
        enrichedItem
      );

    const overLimit =
      !customItem &&
      allowedQuantity !== null &&
      allowedQuantity > 0 &&
      quantity > allowedQuantity;

    const atMax =
      customItem ||
      invalidStock ||
      allowedQuantity <= 0 ||
      quantity >= allowedQuantity;

    return (
      <View
        key={itemKey}
        style={styles.receiptItem}
      >
        <View style={styles.receiptItemLeft}>
          <View style={styles.itemTitleRow}>
            <Text
              style={[
                styles.itemName,
                {
                  fontSize:
                    responsive.itemName,
                },
              ]}
              numberOfLines={2}
            >
              {item.name}
            </Text>

            {unlimited ? (
              <View style={styles.unlimitedBadge}>
                <Text style={styles.unlimitedBadgeText}>
                  Unlimited
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() =>
                handleRemoveItem(item)
              }
            >
              <Text
                style={[
                  styles.removeButtonText,
                  {
                    fontSize:
                      responsive.removeText,
                  },
                ]}
              >
                ×
              </Text>
            </TouchableOpacity>
          </View>

          {customItem ? (
            <>
              <Text
                style={[
                  styles.customPriceText,
                  {
                    fontSize:
                      responsive.itemUnit,
                  },
                ]}
              >
                Price: To be confirmed
              </Text>

              {requestText ? (
                <Text
                  style={[
                    styles.requestText,
                    {
                      fontSize:
                        responsive.requestText,
                    },
                  ]}
                >
                  Request: {requestText}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.itemUnitPrice,
                  {
                    fontSize:
                      responsive.itemUnit,
                  },
                ]}
              >
                ₱{formatMoney(price)} each
              </Text>

              {unlimited ? (
                <Text
                  style={[
                    styles.unlimitedNotice,
                    {
                      fontSize:
                        responsive.noticeText,
                    },
                  ]}
                >
                  Unlimited refills are available. Please ask the service staff for assistance.
                </Text>
              ) : null}

              {allowedQuantity > 0 ? (
                <Text
                  style={[
                    styles.itemLimitText,
                    {
                      fontSize:
                        responsive.noticeText,
                    },
                  ]}
                >
                  Available: {allowedQuantity}
                </Text>
              ) : null}

              {invalidStock ? (
                <Text
                  style={[
                    styles.invalidItemText,
                    {
                      fontSize:
                        responsive.noticeText,
                    },
                  ]}
                >
                  {getAvailabilityDisplayText(enrichedItem) ||
                    'No longer available based on ingredient stock'}
                </Text>
              ) : null}

              {overLimit ? (
                <Text
                  style={[
                    styles.invalidItemText,
                    {
                      fontSize:
                        responsive.noticeText,
                    },
                  ]}
                >
                  Quantity exceeds available ingredient stock
                </Text>
              ) : null}
            </>
          )}

          <View style={styles.quantityRow}>
            <TouchableOpacity
              style={[
                styles.qtyButton,
                {
                  width:
                    responsive.qtyButton,
                  height:
                    responsive.qtyButton,
                  borderRadius:
                    responsive.qtyButton / 3,
                },
              ]}
              onPress={() =>
                handleDecreaseItem(item)
              }
            >
              <Text style={styles.qtyButtonText}>
                -
              </Text>
            </TouchableOpacity>

            <Text
              style={[
                styles.qtyText,
                {
                  fontSize:
                    responsive.qtyText,
                },
              ]}
            >
              {quantity}
            </Text>

            <TouchableOpacity
              style={[
                styles.qtyButton,
                {
                  width:
                    responsive.qtyButton,
                  height:
                    responsive.qtyButton,
                  borderRadius:
                    responsive.qtyButton / 3,
                },
                atMax &&
                  styles.qtyButtonDisabled,
              ]}
              disabled={atMax}
              onPress={() =>
                handleIncreaseItem(item)
              }
            >
              <Text style={styles.qtyButtonText}>
                +
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text
          style={[
            styles.itemSubtotal,
            {
              fontSize:
                responsive.itemSubtotal,
            },
          ]}
          numberOfLines={2}
        >
          {customItem
            ? 'To be confirmed'
            : `₱${formatMoney(subtotal)}`}
        </Text>
      </View>
    );
  };

  const receiptCard = (
    <View
      style={[
        styles.receiptCard,
        {
          padding:
            responsive.cardPadding,
          borderRadius:
            responsive.cardRadius,
        },
        responsive.useTwoPane &&
          styles.receiptTwoPane,
      ]}
    >
      <Text
        style={[
          styles.receiptTitle,
          {
            fontSize:
              responsive.receiptTitle,
          },
        ]}
      >
        Order Summary
      </Text>

      <Text
        style={[
          styles.receiptTable,
          {
            fontSize:
              responsive.receiptTable,
          },
        ]}
      >
        Table {finalTableNumber || '-'}
      </Text>

      <View
        style={[
          styles.receiptDivider,
          {
            marginVertical:
              responsive.dividerMargin,
          },
        ]}
      />

      {cartItems.length === 0 ? (
        <View style={styles.emptyOrderBox}>
          <Text style={styles.emptyOrderText}>
            No items in your order.
          </Text>

          <TouchableOpacity
            style={styles.backToMenuButton}
            onPress={() =>
              navigation.navigate('Menu')
            }
          >
            <Text style={styles.backToMenuText}>
              Back to Menu
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={[
            styles.receiptItemsScroll,
            {
              maxHeight:
                responsive.receiptItemsMaxHeight,
            },
          ]}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          <View style={styles.receiptItemsList}>
            {cartItems.map(
              renderReceiptItem
            )}
          </View>
        </ScrollView>
      )}

      <View
        style={[
          styles.receiptDivider,
          {
            marginVertical:
              responsive.dividerMargin,
          },
        ]}
      />

      <View style={styles.summaryRow}>
        <Text
          style={[
            styles.summaryLabel,
            {
              fontSize:
                responsive.summaryLabel,
            },
          ]}
        >
          Total Items
        </Text>

        <Text
          style={[
            styles.summaryValue,
            {
              fontSize:
                responsive.summaryValue,
            },
          ]}
        >
          {totalItems}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <Text
          style={[
            styles.grandTotalLabel,
            {
              fontSize:
                responsive.totalLabel,
            },
          ]}
        >
          Total Amount
        </Text>

        <Text
          style={[
            styles.grandTotalValue,
            {
              fontSize:
                responsive.totalValue,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          ₱{formatMoney(total)}
        </Text>
      </View>

      {hasCustomRequest ? (
        <Text
          style={[
            styles.customNotice,
            {
              fontSize:
                responsive.noticeText,
            },
          ]}
        >
          Chef Oppa Special requests are not included in the total yet. Final price and availability will be confirmed by staff. QR PH is disabled for custom requests.
        </Text>
      ) : null}
    </View>
  );

  const optionCardContent = (
    <>
      <Text
        style={[
          styles.optionTitle,
          {
            fontSize:
              responsive.optionTitle,
          },
        ]}
      >
        Payment Option
      </Text>

      {hasCustomRequest ? (
        <View style={styles.qrWarningBox}>
          <Text
            style={[
              styles.qrWarningText,
              {
                fontSize:
                  responsive.noticeText,
              },
            ]}
          >
            Chef Oppa Special requests must be confirmed by staff. QR PH payment is not available for custom requests.
          </Text>
        </View>
      ) : null}

      {paymentOptions.map((option) => {
        const active =
          selectedPayment ===
          option.label;

        return (
          <TouchableOpacity
            key={option.label}
            activeOpacity={0.75}
            hitSlop={{
              top: 8,
              bottom: 8,
              left: 8,
              right: 8,
            }}
            style={[
              styles.paymentOption,
              active &&
                styles.paymentOptionActive,
              option.disabled &&
                styles.paymentOptionDisabled,
            ]}
            disabled={option.disabled}
            onPress={() => {
              console.log(
                'PAYMENT OPTION PRESSED:',
                option.label
              );

              handleSelectPayment(option);
            }}
          >
            <Text
              style={[
                styles.paymentOptionTitle,
                {
                  fontSize:
                    responsive.paymentTitle,
                },
                active &&
                  styles.paymentOptionTitleActive,
                option.disabled &&
                  styles.paymentOptionTitleDisabled,
              ]}
            >
              {option.label}
            </Text>

            <Text
              style={[
                styles.paymentOptionDesc,
                {
                  fontSize:
                    responsive.paymentDesc,
                },
              ]}
            >
              {option.description}
            </Text>
          </TouchableOpacity>
        );
      })}

      <View style={styles.disclaimerBox}>
        <Text
          style={[
            styles.disclaimerTitle,
            {
              fontSize:
                responsive.disclaimerTitle,
            },
          ]}
        >
          Disclaimer
        </Text>

        <Text
          style={[
            styles.disclaimerText,
            {
              fontSize:
                responsive.disclaimerText,
            },
          ]}
        >
          Once confirmed, the order cannot be cancelled or changed.
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.75}
        hitSlop={{
          top: 12,
          bottom: 12,
          left: 12,
          right: 12,
        }}
        style={[
          styles.confirmButton,
          {
            paddingVertical:
              responsive.buttonPadding,
          },
          (
            loading ||
            cartItems.length === 0
          ) &&
            styles.confirmButtonDisabled,
        ]}
        disabled={
          loading ||
          cartItems.length === 0
        }
        onPress={() => {
          console.log('CONFIRM TOUCH FIRED');
          handleFinalConfirm();
        }}
      >
        <Text
          style={[
            styles.confirmButtonText,
            {
              fontSize:
                responsive.buttonText,
            },
          ]}
        >
          Confirm Order
        </Text>
      </TouchableOpacity>
    </>
  );

  const optionCard =
    responsive.useTwoPane ? (
      <ScrollView
        style={[
          styles.optionCard,
          {
            padding:
              responsive.cardPadding,
            borderRadius:
              responsive.cardRadius,
            maxHeight:
              responsive.optionMaxHeight,
          },
          styles.optionTwoPane,
        ]}
        contentContainerStyle={{
          paddingBottom: 4,
        }}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        {optionCardContent}
      </ScrollView>
    ) : (
      <View
        style={[
          styles.optionCard,
          {
            padding:
              responsive.cardPadding,
            borderRadius:
              responsive.cardRadius,
          },
        ]}
      >
        {optionCardContent}
      </View>
    );

  if (loading) {
    return (
      <View style={styles.frame}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#efefef"
          translucent={false}
        />

        <SafeAreaView
          style={styles.safeArea}
          edges={[
            'top',
            'left',
            'right',
            'bottom',
          ]}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color="#f68c45"
            />

            <Text
              style={[
                styles.loadingText,
                {
                  fontSize:
                    responsive.buttonText,
                },
              ]}
            >
              Processing your order...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#efefef"
        translucent={false}
      />

      <SafeAreaView
        style={styles.safeArea}
        edges={[
          'top',
          'left',
          'right',
          'bottom',
        ]}
      >
        <View
          style={[
            styles.container,
            {
              padding:
                responsive.containerPadding,
              paddingBottom:
                responsive.safeBottomExtra,
            },
          ]}
        >
          <View
            style={[
              styles.topBar,
              {
                minHeight:
                  responsive.topBarHeight,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() =>
                navigation.goBack()
              }
            >
              <Text
                style={[
                  styles.backText,
                  {
                    fontSize:
                      responsive.backText,
                  },
                ]}
                numberOfLines={1}
              >
                {'<'} Go Back
              </Text>
            </TouchableOpacity>

            <Text
              style={[
                styles.tableText,
                {
                  fontSize:
                    responsive.tableText,
                },
              ]}
              numberOfLines={1}
            >
              Table {finalTableNumber || '-'}
            </Text>
          </View>

          <Text
            style={[
              styles.header,
              {
                fontSize:
                  responsive.header,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Confirm Order
          </Text>

          <Text
            style={[
              styles.subHeader,
              {
                fontSize:
                  responsive.subHeader,
                marginBottom:
                  responsive.subHeaderMargin,
              },
            ]}
          >
            Review your order and choose how you want to settle payment.
          </Text>

          {responsive.useTwoPane ? (
            <View
              style={[
                styles.content,
                {
                  flexDirection: 'row',
                  gap:
                    responsive.contentGap,
                  maxWidth:
                    responsive.maxContentWidth,
                },
              ]}
            >
              {receiptCard}
              {optionCard}
            </View>
          ) : (
            <ScrollView
              style={styles.phoneScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.phoneScrollContent,
                {
                  gap:
                    responsive.contentGap,
                  paddingBottom:
                    responsive.safeBottomExtra +
                    18,
                },
              ]}
            >
              {receiptCard}
              {optionCard}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    frame: {
      flex: 1,
      backgroundColor: '#efefef',
    },

    safeArea: {
      flex: 1,
      backgroundColor: '#efefef',
    },

    container: {
      flex: 1,
      backgroundColor: '#efefef',
    },

    loadingContainer: {
      flex: 1,
      backgroundColor: '#efefef',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },

    loadingText: {
      marginTop: 12,
      fontWeight: '800',
      color: '#333',
      textAlign: 'center',
    },

    topBar: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
    },

    backText: {
      fontWeight: '900',
      color: '#333',
    },

    tableText: {
      fontWeight: '900',
      color: '#f68c45',
      textAlign: 'right',
    },

    header: {
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
      marginTop: 2,
    },

    subHeader: {
      fontWeight: '700',
      color: '#666',
      textAlign: 'center',
      marginTop: 4,
    },

    content: {
      flex: 1,
      alignSelf: 'center',
      width: '100%',
      minHeight: 0,
    },

    phoneScroll: {
      flex: 1,
    },

    phoneScrollContent: {
      paddingBottom: 24,
    },

    receiptCard: {
      backgroundColor: '#fff',
      borderWidth: 1.5,
      borderColor: '#f0b287',
      minHeight: 0,
    },

    receiptTwoPane: {
      flex: 1.08,
    },

    receiptItemsScroll: {
      width: '100%',
    },

    receiptItemsList: {
      width: '100%',
    },

    optionCard: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#ddd',
      minHeight: 0,
    },

    optionTwoPane: {
      flex: 0.92,
    },

    receiptTitle: {
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
    },

    receiptTable: {
      fontWeight: '800',
      color: '#777',
      textAlign: 'center',
      marginTop: 4,
    },

    receiptDivider: {
      height: 1,
      backgroundColor: '#eee',
    },

    receiptItem: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'flex-start',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f3f3',
      gap: 10,
    },

    receiptItemLeft: {
      flex: 1,
      paddingRight: 8,
      minWidth: 0,
    },

    itemTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },

    itemName: {
      flex: 1,
      fontWeight: '900',
      color: '#333',
    },

    removeButton: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f4f4f4',
      flexShrink: 0,
    },

    removeButtonText: {
      fontWeight: '900',
      color: '#999',
      marginTop: -2,
    },

    itemUnitPrice: {
      fontWeight: '700',
      color: '#777',
      marginTop: 3,
    },

    itemLimitText: {
      fontWeight: '900',
      color: '#666',
      marginTop: 4,
    },

    invalidItemText: {
      fontWeight: '900',
      color: '#b00020',
      marginTop: 4,
    },

    customPriceText: {
      fontWeight: '900',
      color: '#f68c45',
      marginTop: 4,
    },

    requestText: {
      fontWeight: '700',
      color: '#666',
      marginTop: 5,
      lineHeight: 18,
    },

    quantityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 10,
    },

    qtyButton: {
      backgroundColor: '#f68c45',
      alignItems: 'center',
      justifyContent: 'center',
    },

    qtyButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    qtyButtonText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 18,
      marginTop: -2,
    },

    qtyText: {
      fontWeight: '900',
      color: '#333',
      minWidth: 24,
      textAlign: 'center',
    },

    itemSubtotal: {
      fontWeight: '900',
      color: '#f68c45',
      textAlign: 'right',
      maxWidth: 150,
      flexShrink: 1,
    },

    unlimitedBadge: {
      backgroundColor: '#2E7D32',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginRight: 6,
      alignSelf: 'center',
    },

    unlimitedBadgeText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 11,
    },

    unlimitedNotice: {
      marginTop: 5,
      color: '#2E7D32',
      fontWeight: '800',
      lineHeight: 18,
    },

    summaryRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginTop: 8,
      gap: 12,
    },

    summaryLabel: {
      fontWeight: '800',
      color: '#555',
    },

    summaryValue: {
      fontWeight: '900',
      color: '#333',
    },

    grandTotalLabel: {
      fontWeight: '900',
      color: '#333',
    },

    grandTotalValue: {
      fontWeight: '900',
      color: '#f68c45',
      flexShrink: 1,
      textAlign: 'right',
    },

    customNotice: {
      marginTop: 14,
      backgroundColor: '#fff4e8',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 12,
      padding: 10,
      color: '#8a4b12',
      fontWeight: '800',
      lineHeight: 18,
      textAlign: 'center',
    },

    emptyOrderBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
    },

    emptyOrderText: {
      fontWeight: '800',
      color: '#777',
      textAlign: 'center',
      marginBottom: 12,
    },

    backToMenuButton: {
      backgroundColor: '#f68c45',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 18,
    },

    backToMenuText: {
      color: '#fff',
      fontWeight: '900',
    },

    optionTitle: {
      fontWeight: '900',
      color: '#333',
      marginBottom: 12,
      textAlign: 'center',
    },

    qrWarningBox: {
      backgroundColor: '#fff4e8',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 14,
      padding: 10,
      marginBottom: 10,
    },

    qrWarningText: {
      color: '#8a4b12',
      fontWeight: '800',
      lineHeight: 18,
      textAlign: 'center',
    },

    paymentOption: {
      borderWidth: 1.5,
      borderColor: '#ddd',
      borderRadius: 16,
      padding: 12,
      marginBottom: 10,
      backgroundColor: '#fafafa',
    },

    paymentOptionActive: {
      borderColor: '#f68c45',
      backgroundColor: '#fff3e8',
    },

    paymentOptionDisabled: {
      opacity: 0.45,
      backgroundColor: '#e6e6e6',
    },

    paymentOptionTitle: {
      fontWeight: '900',
      color: '#333',
    },

    paymentOptionTitleActive: {
      color: '#f68c45',
    },

    paymentOptionTitleDisabled: {
      color: '#777',
    },

    paymentOptionDesc: {
      fontWeight: '700',
      color: '#777',
      marginTop: 4,
      lineHeight: 18,
    },

    disclaimerBox: {
      backgroundColor: '#fff4e8',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 16,
      padding: 12,
      marginTop: 6,
    },

    disclaimerTitle: {
      fontWeight: '900',
      color: '#8a4b12',
      marginBottom: 4,
    },

    disclaimerText: {
      fontWeight: '700',
      color: '#8a4b12',
      lineHeight: 19,
    },

    confirmButton: {
      backgroundColor: '#f68c45',
      borderRadius: 16,
      alignItems: 'center',
      marginTop: 14,
    },

    confirmButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    confirmButtonText: {
      color: '#fff',
      fontWeight: '900',
    },
  });