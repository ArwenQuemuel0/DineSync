import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
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

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getOrderStatus,
  getActiveTableOrders,
} from '../api/dinesync';

import { useAuth } from '../context/AuthContext';
import { useTableStatus } from '../context/TableStatusContext';

import {
  normalizeOrderStatus,
  getOrderStatusLabel,
  isActiveOrderStatus,
  normalizePaymentStatus,
} from '../utils/orderStatus';

const APP_TIME_ZONE =
  process.env.EXPO_PUBLIC_APP_TIMEZONE ||
  'Asia/Manila';

export default function OrderStatusScreen({
  route,
  navigation,
}) {
  const {
    orderId,
    message: routeMessage,
    qrPaymentProcessCompleted = false,
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

      const isPhone =
        shortest < 600;

      const isVeryNarrow =
        width < 390;

      const isLandscape =
        width > height;

      const isShortLandscape =
        isLandscape &&
        height < 430;

      const usableWidth =
        width -
        insets.left -
        insets.right;

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

      const bottomBarNeedsWrap =
        usableWidth < 720;

      const compactBottomBar =
        usableWidth < 420;

      const bottomBarHeight =
        bottomBarNeedsWrap
          ? compactBottomBar
            ? scale(132, 118, 148)
            : scale(124, 108, 138)
          : scale(82, 70, 92);

      const useCompactHeader =
        isVeryNarrow ||
        isShortLandscape ||
        usableWidth < 420;

      return {
        isPhone,
        isVeryNarrow,
        isLandscape,
        isShortLandscape,
        bottomBarNeedsWrap,
        compactBottomBar,
        useCompactHeader,

        safeTopExtra: 0,

        safeBottomExtra:
          Math.max(
            insets.bottom +
            (Platform.OS === 'android' ? 10 : 8),
            16
          ),

        containerPadding:
          isVeryNarrow
            ? scale(12, 10, 14)
            : isPhone
              ? scale(14, 12, 16)
              : scale(24, 16, 26),

        topBarHeight:
          useCompactHeader
            ? scale(50, 44, 54)
            : isPhone
              ? scale(56, 48, 60)
              : scale(66, 52, 70),

        backText:
          useCompactHeader
            ? scale(13, 11, 14)
            : isPhone
              ? scale(16, 14, 17)
              : scale(24, 16, 24),

        tableText:
          useCompactHeader
            ? scale(13, 11, 14)
            : isPhone
              ? scale(16, 14, 17)
              : scale(24, 16, 24),

        header:
          isVeryNarrow
            ? scale(30, 26, 32)
            : isPhone
              ? scale(34, 28, 36)
              : scale(52, 34, 54),

        subHeader:
          isPhone
            ? scale(17, 15, 19)
            : scale(26, 18, 26),

        subHeaderMargin:
          isPhone
            ? scale(12, 10, 14)
            : scale(18, 14, 20),

        loadingText:
          isPhone
            ? scale(18, 15, 20)
            : scale(22, 16, 22),

        errorText:
          isPhone
            ? scale(14, 12, 15)
            : scale(16, 12, 16),

        errorPadding:
          scale(12, 9, 12),

        errorRadius:
          scale(12, 9, 12),

        cardPadding:
          isVeryNarrow
            ? scale(14, 12, 16)
            : isPhone
              ? scale(16, 14, 18)
              : scale(22, 16, 24),

        cardRadius:
          scale(22, 16, 24),

        cardMargin:
          isPhone
            ? scale(16, 14, 18)
            : scale(18, 14, 20),

        orderTitle:
          isPhone
            ? scale(19, 17, 21)
            : scale(26, 19, 26),

        orderMeta:
          isPhone
            ? scale(13, 11, 14)
            : scale(15, 11, 15),

        statusText:
          isPhone
            ? scale(13, 11, 14)
            : scale(16, 11, 16),

        paymentBadgeText:
          isPhone
            ? scale(12, 10, 13)
            : scale(14, 11, 14),

        badgePaddingV:
          isPhone
            ? scale(7, 5, 8)
            : scale(8, 5, 8),

        badgePaddingH:
          isPhone
            ? scale(11, 9, 13)
            : scale(18, 10, 18),

        paymentBadgePaddingV:
          scale(6, 5, 6),

        paymentBadgePaddingH:
          isPhone
            ? scale(11, 9, 13)
            : scale(14, 9, 14),

        paymentMessage:
          isPhone
            ? scale(14, 12, 15)
            : scale(16, 12, 16),

        paymentMessageLine:
          isPhone
            ? scale(20, 17, 21)
            : scale(22, 17, 22),

        paymentMessagePaddingV:
          scale(10, 7, 10),

        paymentMessagePaddingH:
          scale(14, 10, 14),

        continuePaymentMargin:
          scale(12, 8, 14),

        continuePaymentPaddingV:
          isPhone
            ? scale(11, 9, 13)
            : scale(12, 9, 13),

        continuePaymentPaddingH:
          scale(16, 12, 18),

        continuePaymentRadius:
          scale(14, 10, 14),

        continuePaymentText:
          isPhone
            ? scale(15, 13, 16)
            : scale(16, 13, 17),

        dividerMargin:
          isPhone
            ? scale(12, 10, 14)
            : scale(16, 10, 16),

        noItemsText:
          isPhone
            ? scale(14, 12, 15)
            : scale(16, 12, 16),

        itemName:
          isPhone
            ? scale(15, 13, 17)
            : scale(19, 14, 19),

        itemQty:
          isPhone
            ? scale(13, 11, 14)
            : scale(15, 11, 15),

        customPrice:
          isPhone
            ? scale(13, 11, 14)
            : scale(14, 11, 14),

        requestText:
          isPhone
            ? scale(13, 11, 14)
            : scale(14, 11, 14),

        itemPrice:
          isPhone
            ? scale(15, 13, 17)
            : scale(18, 13, 18),

        totalLabel:
          isPhone
            ? scale(17, 15, 19)
            : scale(22, 16, 22),

        totalValue:
          isPhone
            ? scale(21, 18, 23)
            : scale(26, 20, 26),

        emptyIcon:
          isPhone
            ? scale(66, 52, 72)
            : scale(80, 55, 82),

        emptyTitle:
          isPhone
            ? scale(23, 20, 25)
            : scale(36, 24, 36),

        emptyText:
          isPhone
            ? scale(15, 13, 17)
            : scale(18, 13, 18),

        emptyLine:
          isPhone
            ? scale(22, 19, 24)
            : scale(25, 19, 25),

        bottomBarLeft:
          isVeryNarrow
            ? scale(12, 10, 14)
            : isPhone
              ? scale(14, 12, 16)
              : scale(24, 16, 24),

        bottomBarBottom:
          Math.max(
            insets.bottom +
            (Platform.OS === 'android' ? 8 : 6),
            12
          ),

        bottomBarPadding:
          isPhone
            ? scale(10, 8, 12)
            : scale(14, 10, 14),

        bottomBarRadius:
          scale(18, 14, 18),

        bottomBarHeight,

        autoText:
          isPhone
            ? scale(13, 11, 14)
            : scale(15, 11, 15),

        buttonPaddingV:
          isPhone
            ? scale(10, 8, 11)
            : scale(11, 8, 11),

        buttonPaddingH:
          isPhone
            ? scale(14, 10, 16)
            : scale(22, 14, 22),

        buttonRadius:
          scale(12, 9, 12),

        buttonText:
          isPhone
            ? scale(15, 13, 16)
            : scale(16, 12, 16),

        listBottom:
          bottomBarHeight +
          Math.max(
            insets.bottom + 36,
            58
          ),

        maxContentWidth:
          clamp(longest * 0.94, 340, 1100),
      };
    }, [
      width,
      height,
      insets.left,
      insets.right,
      insets.bottom,
    ]);

  const {
    tableNumber,
    user,
  } = useAuth();

  const {
    tableResetRequired,
    acknowledgeTableReset,
  } = useTableStatus();

  const finalTableNumber =
    tableNumber ||
    user?.table_number;

  const [orders, setOrders] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [
    completedQrPaymentProcessOrderIds,
    setCompletedQrPaymentProcessOrderIds,
  ] = useState([]);

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
    const loadCompletedQrPaymentProcesses =
      async () => {
        try {
          const raw =
            await AsyncStorage.getItem(
              'completedQrPaymentProcessOrderIds'
            );

          const ids =
            raw ? JSON.parse(raw) : [];

          setCompletedQrPaymentProcessOrderIds(
            Array.isArray(ids)
              ? ids.map((id) => String(id))
              : []
          );
        } catch (storageError) {
          console.log(
            'LOAD COMPLETED QR PAYMENT PROCESS ERROR:',
            storageError
          );
        }
      };

    loadCompletedQrPaymentProcesses();

    const unsubscribe =
      navigation.addListener(
        'focus',
        loadCompletedQrPaymentProcesses
      );

    return unsubscribe;
  }, [
    navigation,
  ]);

  useEffect(() => {
    fetchOrders();

    const interval =
      setInterval(() => {
        fetchOrders(false);
      }, 5000);

    return () =>
      clearInterval(interval);
  }, [
    finalTableNumber,
    orderId,
  ]);

  const fetchSpecificOrder = async () => {
    if (!orderId) {
      return null;
    }

    const response =
      await getOrderStatus(orderId);

    if (response.success) {
      return response.data;
    }

    return null;
  };

  const isVisibleOrderStatus = (
    status
  ) => {
    const normalized =
      normalizeOrderStatus(status);

    return (
      isActiveOrderStatus(status) ||
      normalized === 'awaiting_payment' ||
      normalized === 'served' ||
      normalized === 'completed'
    );
  };

  const fetchOrders = async (
    showLoading = true
  ) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      if (!finalTableNumber) {
        setError(
          'No table number found.'
        );

        return;
      }

      if (orderId) {
        const specificOrder =
          await fetchSpecificOrder();

        if (specificOrder) {
          setOrders([specificOrder]);
          setError('');
          return;
        }
      }

      const response =
        await getActiveTableOrders(
          finalTableNumber
        );

      if (response.success) {
        const activeOrders = (
          response.data || []
        ).filter((order) =>
          isVisibleOrderStatus(
            order.status
          )
        );

        setOrders(activeOrders);

        setError('');
      } else {
        setError(
          response.message ||
          'Failed to load orders.'
        );
      }
    } catch (err) {
      console.log(
        'ACTIVE ORDERS ERROR:',
        err?.response?.data ||
        err.message ||
        err
      );

      setError(
        'Unable to load active orders.'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (value) => {
    const n = Number(value);

    return Number.isFinite(n)
      ? n.toFixed(2)
      : '0.00';
  };

  const formatDateTime = (value) => {
    if (!value) return '';

    const date =
      value instanceof Date
        ? value
        : new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }

    return new Intl.DateTimeFormat(
      'en-PH',
      {
        timeZone: APP_TIME_ZONE,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }
    ).format(date);
  };

  const normalizePaymentMethod = (
    value
  ) => {
    const normalized =
      String(value || 'Pay Later')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');

    if (
      normalized === 'qr ph' ||
      normalized === 'qrph' ||
      normalized === 'xendit' ||
      normalized === 'online payment' ||
      normalized === 'digital payment'
    ) {
      return 'QR PH';
    }

    if (
      normalized === 'cash' ||
      normalized === 'cash paid'
    ) {
      return 'Cash';
    }

    if (
      normalized === 'pay later' ||
      normalized === 'later'
    ) {
      return 'Pay Later';
    }

    if (
      normalized === 'pay at counter' ||
      normalized === 'counter' ||
      normalized === 'cashier'
    ) {
      return 'Pay at Counter';
    }

    return value || 'Pay Later';
  };

  const getPaymentMethodLabel = (
    order
  ) => {
    const paymentMethod =
      normalizePaymentMethod(
        order.payment_method
      );

    if (paymentMethod === 'QR PH') {
      return 'QR PH';
    }

    if (paymentMethod === 'Pay at Counter') {
      return 'Pay at Counter';
    }

    if (paymentMethod === 'Pay Later') {
      return 'Pay Later';
    }

    if (paymentMethod === 'Cash') {
      return 'Cash';
    }

    return paymentMethod || 'Pay Later';
  };

  const getOrderInvoiceUrl = (
    order
  ) => {
    return (
      order?.xendit_invoice_url ||
      order?.invoice_url ||
      order?.payment_url ||
      order?.checkout_url ||
      null
    );
  };

  const isSameRouteOrder = (
    order
  ) => {
    return (
      orderId &&
      Number(order?.id) ===
      Number(orderId)
    );
  };

  const hasCompletedQrPaymentProcess = (
    order
  ) => {
    const orderIdString =
      String(order?.id || '');

    if (!orderIdString) {
      return false;
    }

    return (
      completedQrPaymentProcessOrderIds.includes(
        orderIdString
      ) ||
      (
        qrPaymentProcessCompleted &&
        isSameRouteOrder(order)
      )
    );
  };

  const canContinueQrPayment = (
    order
  ) => {
    const paymentMethod =
      normalizePaymentMethod(
        order.payment_method
      );

    const paymentStatus =
      normalizePaymentStatus(
        order.payment_status
      );

    const orderStatus =
      normalizeOrderStatus(
        order.status
      );

    const invoiceUrl =
      getOrderInvoiceUrl(order);

    const completedProcess =
      hasCompletedQrPaymentProcess(order);

    return (
      paymentMethod === 'QR PH' &&
      paymentStatus === 'pending' &&
      orderStatus === 'awaiting_payment' &&
      Boolean(invoiceUrl) &&
      !completedProcess
    );
  };

  const handleContinueQrPayment = (
    order
  ) => {
    const invoiceUrl =
      getOrderInvoiceUrl(order);

    if (!invoiceUrl) {
      setError(
        'QR PH checkout link is missing. Please ask restaurant staff for assistance.'
      );

      return;
    }

    navigation.navigate(
      'PaymentWebView',
      {
        orderId:
          order.id,
        invoiceUrl,
        message:
          'Continue your QR PH payment. Your order will be sent to the kitchen after payment is confirmed.',
      }
    );
  };

  const getEffectiveOrderStatus = (
    order
  ) => {
    const orderStatus =
      normalizeOrderStatus(
        order.status
      );

    return orderStatus;
  };

  const isCustomOrderItem = (
    orderItem
  ) => {
    const category =
      String(
        orderItem?.category ||
        orderItem?.menu_item?.category ||
        ''
      )
        .trim()
        .toLowerCase();

    const inventoryType =
      String(
        orderItem?.inventory_type ||
        orderItem?.menu_item?.inventory_type ||
        ''
      )
        .trim()
        .toLowerCase();

    const name =
      String(
        orderItem?.name ||
        orderItem?.menu_name ||
        orderItem?.menu_item?.name ||
        ''
      )
        .trim()
        .toLowerCase();

    return (
      category === 'chef oppa special' ||
      inventoryType === 'custom' ||
      name.includes(
        'custom chef oppa special'
      )
    );
  };

  const getRequestText = (
    orderItem
  ) => {
    return (
      orderItem?.special_request ||
      orderItem?.notes ||
      orderItem?.note ||
      orderItem?.request ||
      ''
    );
  };

  const getStatusStyle = (
    order
  ) => {
    const normalized =
      getEffectiveOrderStatus(order);

    if (
      normalized === 'awaiting_payment'
    ) {
      return styles.statusAwaitingPayment;
    }

    if (
      normalized === 'pending'
    ) {
      return styles.statusPending;
    }

    if (
      normalized === 'preparing'
    ) {
      return styles.statusPreparing;
    }

    if (
      normalized === 'ready'
    ) {
      return styles.statusReady;
    }

    return styles.statusDefault;
  };

  const getDisplayOrderStatusLabel = (
    order
  ) => {
    const normalized =
      getEffectiveOrderStatus(order);

    if (
      normalized === 'awaiting_payment'
    ) {
      return 'Awaiting Payment';
    }

    return getOrderStatusLabel(normalized);
  };

  const getPaymentStatusStyle = (
    paymentStatus
  ) => {
    const normalized =
      normalizePaymentStatus(paymentStatus);

    if (
      normalized === 'paid'
    ) {
      return styles.paymentPaid;
    }

    if (
      normalized === 'expired'
    ) {
      return styles.paymentExpired;
    }

    if (
      normalized === 'failed'
    ) {
      return styles.paymentFailed;
    }

    return styles.paymentPending;
  };

  const getPaymentMessage = (
    order
  ) => {
    const paymentStatus =
      normalizePaymentStatus(
        order.payment_status
      );

    const orderStatus =
      getEffectiveOrderStatus(order);

    const paymentMethod =
      normalizePaymentMethod(
        order.payment_method
      );

    if (
      paymentMethod === 'QR PH' &&
      paymentStatus === 'pending' &&
      hasCompletedQrPaymentProcess(order)
    ) {
      return 'QR PH payment process completed. Checking payment confirmation from the system...';
    }

    if (
      paymentMethod === 'QR PH' &&
      paymentStatus === 'pending'
    ) {
      return 'Waiting for Xendit QR PH payment confirmation. Your order will be sent to the kitchen after payment is confirmed.';
    }

    if (
      paymentMethod === 'Pay at Counter' &&
      paymentStatus === 'pending'
    ) {
      return 'Order recorded. Please proceed to the counter to pay before the kitchen prepares your order.';
    }

    if (
      paymentMethod === 'Pay Later' &&
      paymentStatus === 'pending'
    ) {
      return 'Order sent to kitchen. Please settle payment later with staff.';
    }

    if (
      paymentStatus === 'paid' &&
      paymentMethod === 'Cash'
    ) {
      return 'Cash payment received. Your order has been sent to the kitchen.';
    }

    if (
      paymentStatus === 'paid' &&
      paymentMethod === 'QR PH'
    ) {
      return 'QR PH payment confirmed. Your order has been sent to the kitchen.';
    }

    if (
      paymentStatus === 'paid' &&
      orderStatus === 'pending'
    ) {
      return 'Payment confirmed. Your order has been sent to the kitchen.';
    }

    if (paymentStatus === 'expired') {
      return 'Payment expired. Please ask restaurant staff for help.';
    }

    if (paymentStatus === 'failed') {
      return 'Payment failed. Please try again or ask restaurant staff for help.';
    }

    return routeMessage || '';
  };

  const getPaymentLabel = (
    order
  ) => {
    const paymentStatus =
      normalizePaymentStatus(
        order.payment_status
      );

    if (paymentStatus === 'paid') {
      return 'Paid';
    }

    if (paymentStatus === 'expired') {
      return 'Expired';
    }

    if (paymentStatus === 'failed') {
      return 'Failed';
    }

    return 'Pending';
  };

  const getOrderTotal = (
    order
  ) => {
    if (
      order.total_amount ||
      order.total
    ) {
      return Number(
        order.total_amount ||
        order.total
      );
    }

    const items =
      order.items ||
      order.order_items ||
      [];

    return items.reduce(
      (sum, item) => {
        if (isCustomOrderItem(item)) {
          return sum;
        }

        const price =
          Number(
            item.price ||
            item.menu_item?.price ||
            0
          );

        const quantity =
          Number(
            item.quantity || 0
          );

        return (
          sum + price * quantity
        );
      },
      0
    );
  };

  const renderOrderItem = ({
    item,
  }) => {
    const items =
      item.items ||
      item.order_items ||
      [];

    const paymentMessage =
      getPaymentMessage(item);

    const paymentMethod =
      getPaymentMethodLabel(item);

    const showContinueQrPayment =
      canContinueQrPayment(item);

    return (
      <View
        style={[
          styles.orderCard,
          {
            padding:
              responsive.cardPadding,
            borderRadius:
              responsive.cardRadius,
            marginBottom:
              responsive.cardMargin,
          },
        ]}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text
              style={[
                styles.orderTitle,
                {
                  fontSize:
                    responsive.orderTitle,
                },
              ]}
              numberOfLines={2}
            >
              {item.order_number
                ? item.order_number
                : `Order #${item.id}`}
            </Text>

            <Text
              style={[
                styles.orderDate,
                {
                  fontSize:
                    responsive.orderMeta,
                },
              ]}
            >
              {formatDateTime(
                item.created_at
              )}
            </Text>

            <Text
              style={[
                styles.tableNumberText,
                {
                  fontSize:
                    responsive.orderMeta,
                },
              ]}
            >
              Table {item.table_number || finalTableNumber || '-'}
            </Text>

            <Text
              style={[
                styles.paymentMethodText,
                {
                  fontSize:
                    responsive.orderMeta,
                },
              ]}
            >
              Payment Method: {paymentMethod}
            </Text>
          </View>

          <View style={styles.orderHeaderRight}>
            <View
              style={[
                styles.statusBadge,
                {
                  paddingVertical:
                    responsive.badgePaddingV,
                  paddingHorizontal:
                    responsive.badgePaddingH,
                },
                getStatusStyle(item),
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    fontSize:
                      responsive.statusText,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {getDisplayOrderStatusLabel(item)}
              </Text>
            </View>

            <View
              style={[
                styles.paymentBadge,
                {
                  paddingVertical:
                    responsive.paymentBadgePaddingV,
                  paddingHorizontal:
                    responsive.paymentBadgePaddingH,
                },
                getPaymentStatusStyle(
                  item.payment_status
                ),
              ]}
            >
              <Text
                style={[
                  styles.paymentBadgeText,
                  {
                    fontSize:
                      responsive.paymentBadgeText,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {getPaymentLabel(item)}
              </Text>
            </View>
          </View>
        </View>

        {paymentMessage ? (
          <Text
            style={[
              styles.paymentMessage,
              {
                fontSize:
                  responsive.paymentMessage,
                lineHeight:
                  responsive.paymentMessageLine,
                paddingVertical:
                  responsive.paymentMessagePaddingV,
                paddingHorizontal:
                  responsive.paymentMessagePaddingH,
              },
            ]}
          >
            {paymentMessage}
          </Text>
        ) : null}

        {showContinueQrPayment ? (
          <TouchableOpacity
            style={[
              styles.continuePaymentBtn,
              {
                marginTop:
                  responsive.continuePaymentMargin,
                paddingVertical:
                  responsive.continuePaymentPaddingV,
                paddingHorizontal:
                  responsive.continuePaymentPaddingH,
                borderRadius:
                  responsive.continuePaymentRadius,
              },
            ]}
            onPress={() =>
              handleContinueQrPayment(
                item
              )
            }
          >
            <Text
              style={[
                styles.continuePaymentText,
                {
                  fontSize:
                    responsive.continuePaymentText,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Continue QR PH Payment
            </Text>
          </TouchableOpacity>
        ) : null}

        <View
          style={[
            styles.divider,
            {
              marginVertical:
                responsive.dividerMargin,
            },
          ]}
        />

        {items.length === 0 ? (
          <Text
            style={[
              styles.noItemsText,
              {
                fontSize:
                  responsive.noItemsText,
              },
            ]}
          >
            No order items found.
          </Text>
        ) : (
          items.map(
            (
              orderItem,
              index
            ) => {
              const name =
                orderItem.name ||
                orderItem.menu_name ||
                orderItem.menu_item
                  ?.name ||
                'Menu Item';

              const customItem =
                isCustomOrderItem(
                  orderItem
                );

              const quantity =
                customItem
                  ? 1
                  : Number(
                    orderItem.quantity ||
                    0
                  );

              const price =
                customItem
                  ? 0
                  : Number(
                    orderItem.price ||
                    orderItem.menu_item
                      ?.price ||
                    0
                  );

              const requestText =
                getRequestText(
                  orderItem
                );

              return (
                <View
                  key={`${item.id}-${index}`}
                  style={styles.itemRow}
                >
                  <View style={styles.itemLeft}>
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
                      {name}
                    </Text>

                    <Text
                      style={[
                        styles.itemQty,
                        {
                          fontSize:
                            responsive.itemQty,
                        },
                      ]}
                    >
                      Qty: {quantity}
                    </Text>

                    {customItem ? (
                      <>
                        <Text
                          style={[
                            styles.customPriceText,
                            {
                              fontSize:
                                responsive.customPrice,
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
                    ) : null}
                  </View>

                  <Text
                    style={[
                      styles.itemPrice,
                      {
                        fontSize:
                          responsive.itemPrice,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {customItem
                      ? 'To be confirmed'
                      : `₱${formatMoney(
                        price *
                        quantity
                      )}`}
                  </Text>
                </View>
              );
            }
          )
        )}

        <View style={styles.totalRow}>
          <Text
            style={[
              styles.totalLabel,
              {
                fontSize:
                  responsive.totalLabel,
              },
            ]}
          >
            Total
          </Text>

          <Text
            style={[
              styles.totalValue,
              {
                fontSize:
                  responsive.totalValue,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            ₱
            {formatMoney(
              getOrderTotal(item)
            )}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.frame}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#efefef"
          translucent={false}
        />

        <SafeAreaView
          style={styles.safeAreaLight}
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
                    responsive.loadingText,
                },
              ]}
            >
              Loading active orders...
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
        style={styles.safeAreaLight}
        edges={[
          'top',
          'left',
          'right',
        ]}
      >
        <View
          style={[
            styles.container,
            {
              padding:
                responsive.containerPadding,
              paddingTop:
                responsive.containerPadding +
                responsive.safeTopExtra,
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
              style={styles.topBarLeft}
              onPress={() =>
                navigation.navigate(
                  'Menu'
                )
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
                adjustsFontSizeToFit
              >
                {'<'} Back to Menu
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
              adjustsFontSizeToFit
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
            minimumFontScale={0.75}
          >
            Order Status
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
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {orderId
              ? `Order #${orderId}`
              : 'Active Orders'}
          </Text>

          {error ? (
            <Text
              style={[
                styles.errorText,
                {
                  fontSize:
                    responsive.errorText,
                  padding:
                    responsive.errorPadding,
                  borderRadius:
                    responsive.errorRadius,
                },
              ]}
            >
              {error}
            </Text>
          ) : null}

          {orders.length === 0 ? (
            <View
              style={[
                styles.emptyBox,
                {
                  paddingBottom:
                    responsive.listBottom,
                },
              ]}
            >
              <Text
                style={[
                  styles.emptyIcon,
                  {
                    fontSize:
                      responsive.emptyIcon,
                  },
                ]}
              >
                🧾
              </Text>

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    fontSize:
                      responsive.emptyTitle,
                  },
                ]}
              >
                No Active Orders
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  {
                    fontSize:
                      responsive.emptyText,
                    lineHeight:
                      responsive.emptyLine,
                  },
                ]}
              >
                Pending, preparing, ready, served, completed, and awaiting payment orders will appear here based on kitchen progress. Payment status is shown separately.
              </Text>
            </View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(item) =>
                String(item.id)
              }
              renderItem={renderOrderItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.listContent,
                {
                  paddingBottom:
                    responsive.listBottom,
                  maxWidth:
                    responsive.maxContentWidth,
                },
              ]}
            />
          )}

          <View
            style={[
              styles.bottomBar,
              {
                left:
                  responsive.bottomBarLeft,
                right:
                  responsive.bottomBarLeft,
                bottom:
                  responsive.bottomBarBottom,
                padding:
                  responsive.bottomBarPadding,
                borderRadius:
                  responsive.bottomBarRadius,
                minHeight:
                  responsive.bottomBarHeight,
                flexDirection:
                  responsive.bottomBarNeedsWrap
                    ? 'column'
                    : 'row',
                alignItems:
                  responsive.bottomBarNeedsWrap
                    ? 'stretch'
                    : 'center',
              },
            ]}
          >
            <Text
              style={[
                styles.autoText,
                {
                  fontSize:
                    responsive.autoText,
                  textAlign:
                    responsive.bottomBarNeedsWrap
                      ? 'center'
                      : 'left',
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Updates every 5 seconds
            </Text>

            <View
              style={[
                styles.bottomActions,
                {
                  justifyContent:
                    responsive.bottomBarNeedsWrap
                      ? 'center'
                      : 'flex-end',
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.refreshBtn,
                  {
                    paddingVertical:
                      responsive.buttonPaddingV,
                    paddingHorizontal:
                      responsive.buttonPaddingH,
                    borderRadius:
                      responsive.buttonRadius,
                  },
                ]}
                onPress={() =>
                  fetchOrders(true)
                }
              >
                <Text
                  style={[
                    styles.refreshText,
                    {
                      fontSize:
                        responsive.buttonText,
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  Refresh
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.menuBtn,
                  {
                    paddingVertical:
                      responsive.buttonPaddingV,
                    paddingHorizontal:
                      responsive.buttonPaddingH,
                    borderRadius:
                      responsive.buttonRadius,
                  },
                ]}
                onPress={() =>
                  navigation.navigate(
                    'Menu'
                  )
                }
              >
                <Text
                  style={[
                    styles.menuText,
                    {
                      fontSize:
                        responsive.buttonText,
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  Continue Ordering
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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

    safeAreaLight: {
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
      marginTop: 16,
      fontWeight: '700',
      color: '#555',
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

    topBarLeft: {
      flex: 1,
      minWidth: 0,
    },

    backText: {
      fontWeight: '800',
      color: '#333',
    },

    tableText: {
      flexShrink: 1,
      fontWeight: '900',
      color: '#f68c45',
      textAlign: 'right',
    },

    header: {
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
      marginTop: 8,
    },

    subHeader: {
      fontWeight: '800',
      color: '#666',
      textAlign: 'center',
    },

    errorText: {
      backgroundColor: '#ffe5e5',
      color: '#b00020',
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 12,
    },

    listContent: {
      width: '100%',
      alignSelf: 'center',
    },

    orderCard: {
      backgroundColor: '#fff',
      borderWidth: 1.5,
      borderColor: '#f0b287',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 7,
      elevation: 3,
    },

    orderHeader: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },

    orderHeaderLeft: {
      flex: 1,
      paddingRight: 8,
      minWidth: 0,
    },

    orderTitle: {
      fontWeight: '900',
      color: '#333',
    },

    orderDate: {
      marginTop: 4,
      fontWeight: '700',
      color: '#888',
    },

    tableNumberText: {
      marginTop: 5,
      fontWeight: '800',
      color: '#666',
    },

    paymentMethodText: {
      marginTop: 3,
      fontWeight: '800',
      color: '#666',
    },

    orderHeaderRight: {
      alignItems: 'flex-end',
      maxWidth: 165,
      flexShrink: 1,
    },

    statusBadge: {
      borderRadius: 999,
      maxWidth: 165,
      minWidth: 78,
    },

    paymentBadge: {
      borderRadius: 999,
      marginTop: 8,
      maxWidth: 165,
      minWidth: 78,
    },

    statusBadgeText: {
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
    },

    paymentBadgeText: {
      fontWeight: '800',
      color: '#333',
      textAlign: 'center',
    },

    paymentMessage: {
      marginTop: 14,
      backgroundColor: '#fff3e8',
      color: '#333',
      borderRadius: 12,
      fontWeight: '800',
    },

    continuePaymentBtn: {
      backgroundColor: '#f68c45',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 5,
      elevation: 2,
    },

    continuePaymentText: {
      color: '#fff',
      fontWeight: '900',
      textAlign: 'center',
    },

    paymentPending: {
      backgroundColor: '#ffeeba',
    },

    paymentPaid: {
      backgroundColor: '#c3e6cb',
    },

    paymentExpired: {
      backgroundColor: '#e2e3e5',
    },

    paymentFailed: {
      backgroundColor: '#f5c6cb',
    },

    statusAwaitingPayment: {
      backgroundColor: '#fde68a',
    },

    statusPending: {
      backgroundColor: '#fff3cd',
    },

    statusPreparing: {
      backgroundColor: '#dbeafe',
    },

    statusReady: {
      backgroundColor: '#dcfce7',
    },

    statusDefault: {
      backgroundColor: '#eeeeee',
    },

    divider: {
      height: 1,
      backgroundColor: '#eee',
    },

    noItemsText: {
      color: '#888',
      fontWeight: '700',
    },

    itemRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'flex-start',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#f2f2f2',
      gap: 12,
    },

    itemLeft: {
      flex: 1,
      paddingRight: 8,
      minWidth: 0,
    },

    itemName: {
      fontWeight: '900',
      color: '#333',
    },

    itemQty: {
      fontWeight: '700',
      color: '#777',
      marginTop: 3,
    },

    customPriceText: {
      fontWeight: '900',
      color: '#f68c45',
      marginTop: 4,
    },

    requestText: {
      marginTop: 5,
      fontWeight: '700',
      color: '#666',
      lineHeight: 20,
    },

    itemPrice: {
      fontWeight: '900',
      color: '#f68c45',
      textAlign: 'right',
      maxWidth: 160,
      flexShrink: 1,
    },

    totalRow: {
      marginTop: 16,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      gap: 12,
    },

    totalLabel: {
      fontWeight: '900',
      color: '#333',
    },

    totalValue: {
      fontWeight: '900',
      color: '#f68c45',
      flexShrink: 1,
      textAlign: 'right',
    },

    emptyBox: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 18,
    },

    emptyIcon: {
      marginBottom: 16,
    },

    emptyTitle: {
      fontWeight: '900',
      color: '#333',
      marginBottom: 8,
      textAlign: 'center',
    },

    emptyText: {
      color: '#777',
      fontWeight: '700',
      textAlign: 'center',
      maxWidth: 620,
    },

    bottomBar: {
      position: 'absolute',
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#ddd',
      gap: 10,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },

    autoText: {
      fontWeight: '800',
      color: '#777',
    },

    bottomActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },

    refreshBtn: {
      backgroundColor: '#333',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 1,
      flexGrow: 1,
      minWidth: 105,
    },

    menuBtn: {
      backgroundColor: '#f68c45',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 1,
      flexGrow: 1,
      minWidth: 145,
    },

    refreshText: {
      color: '#fff',
      fontWeight: '900',
      textAlign: 'center',
    },

    menuText: {
      color: '#fff',
      fontWeight: '900',
      textAlign: 'center',
    },
  });