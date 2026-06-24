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
} from '../api/dinesync';

import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTableStatus } from '../context/TableStatusContext';
import { TABLE_ASSIGNMENT_MESSAGE } from '../constants/tableStatus';

import {
  isCustomItem,
} from '../utils/inventory';

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

      const isPortrait =
        height >= width;

      const isPhone =
        width < 600;

      const isVeryNarrow =
        width < 430;

      const base =
        shortest / 768;

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

      const scale = (
        size,
        min = size * 0.65,
        max = size * 1.08
      ) => {
        return Math.round(
          clamp(size * base, min, max)
        );
      };

      const useTwoPane =
        !isPortrait &&
        width >= 720 &&
        height >= 520;

      const screenPadding =
        isVeryNarrow
          ? scale(12, 10, 14)
          : isPhone
            ? scale(14, 12, 16)
            : scale(22, 16, 24);

      return {
        isPhone,
        isVeryNarrow,
        useTwoPane,

        safeTopExtra: 0,

        safeBottomExtra:
          Math.max(insets.bottom + 6, 12),

        containerPadding:
          screenPadding,

        topBarHeight:
          isPhone
            ? scale(50, 44, 54)
            : scale(58, 48, 62),

        backText:
          isPhone
            ? scale(17, 15, 18)
            : scale(24, 17, 24),

        tableText:
          isPhone
            ? scale(17, 15, 18)
            : scale(24, 17, 24),

        header:
          isVeryNarrow
            ? scale(30, 26, 32)
            : isPhone
              ? scale(34, 28, 36)
              : scale(46, 32, 48),

        subHeader:
          isPhone
            ? scale(14, 12, 15)
            : scale(18, 14, 18),

        subHeaderMargin:
          isPhone
            ? scale(12, 10, 14)
            : scale(18, 14, 20),

        contentGap:
          isPhone
            ? scale(14, 12, 16)
            : scale(18, 12, 20),

        cardPadding:
          isVeryNarrow
            ? scale(14, 12, 15)
            : isPhone
              ? scale(16, 13, 18)
              : scale(22, 16, 24),

        cardRadius:
          scale(22, 16, 24),

        receiptTitle:
          isPhone
            ? scale(23, 20, 24)
            : scale(30, 22, 30),

        receiptTable:
          scale(18, 13, 18),

        dividerMargin:
          isPhone
            ? scale(12, 9, 13)
            : scale(16, 10, 16),

        itemName:
          scale(19, 14, 19),

        itemUnit:
          scale(14, 11, 14),

        itemSubtotal:
          scale(18, 13, 18),

        requestText:
          scale(14, 11, 14),

        summaryLabel:
          scale(18, 14, 18),

        summaryValue:
          scale(20, 15, 20),

        totalLabel:
          isPhone
            ? scale(18, 16, 19)
            : scale(23, 17, 23),

        totalValue:
          isPhone
            ? scale(23, 20, 24)
            : scale(28, 22, 28),

        noticeText:
          scale(14, 11, 14),

        optionTitle:
          isPhone
            ? scale(21, 18, 22)
            : scale(26, 20, 26),

        paymentTitle:
          scale(20, 15, 20),

        paymentDesc:
          scale(14, 11, 14),

        disclaimerTitle:
          scale(18, 14, 18),

        disclaimerText:
          scale(15, 12, 15),

        buttonText:
          scale(20, 15, 20),

        buttonPadding:
          scale(16, 12, 16),

        maxContentWidth:
          clamp(longest * 0.95, 340, 1300),
      };
    }, [
      width,
      height,
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
      return cartItems.some(isCustomItem);
    }, [cartItems]);

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

  const selectedOption =
    useMemo(() => {
      return (
        paymentOptions.find(
          (option) =>
            option.label === selectedPayment
        ) || paymentOptions[0]
      );
    }, [
      paymentOptions,
      selectedPayment,
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

    console.log(
      'SELECTED PAYMENT OPTION:',
      {
        label:
          option.label,
        apiMethod:
          option.apiMethod,
      }
    );

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

  const handleFinalConfirm = async () => {
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

    console.log(
      'CONFIRM PAYMENT SNAPSHOT:',
      {
        selectedPayment,
        label:
          paymentSnapshot.label,
        apiMethod:
          paymentSnapshot.apiMethod,
      }
    );

    Alert.alert(
      'Confirm Order',
      getConfirmDialogMessage(
        paymentSnapshot.label
      ),
      [
        {
          text: 'Go Back',
          style: 'cancel',
        },
        {
          text: 'Confirm Order',
          style: 'destructive',
          onPress: () =>
            submitOrder(
              paymentSnapshot
            ),
        },
      ]
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

      console.log(
        'SUBMIT ORDER PAYMENT:',
        {
          label:
            selectedPaymentOption.label,
          apiMethod:
            selectedPaymentOption.apiMethod,
        }
      );

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
        await refreshCartInventory();

      if (!inventoryCheck.valid) {
        Alert.alert(
          'Limited Stock',
          inventoryCheck.message
        );

        return;
      }

      const orderResponse =
        await placeOrder(
          cartItems,
          finalTableNumber,
          selectedPaymentOption.apiMethod
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

      const isInventoryError =
        statusCode === 422 ||
        statusCode === 400;

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

  const renderReceiptItem = (
    item,
    index
  ) => {
    const customItem =
      isCustomItem(item);

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
        item.menu_item_id ||
          item.id ||
          index
      );

    return (
      <View
        key={itemKey}
        style={styles.receiptItem}
      >
        <View style={styles.receiptItemLeft}>
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
            {quantity}x {item.name}
          </Text>

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
          )}
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

      <View style={styles.receiptItemsList}>
        {cartItems.map(
          renderReceiptItem
        )}
      </View>

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
          Chef Oppa Special requests are not included in the total yet. Final price and availability will be confirmed by staff.
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
            style={[
              styles.paymentOption,
              active &&
                styles.paymentOptionActive,
              option.disabled &&
                styles.paymentOptionDisabled,
            ]}
            disabled={option.disabled}
            onPress={() =>
              handleSelectPayment(option)
            }
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
        style={[
          styles.confirmButton,
          {
            paddingVertical:
              responsive.buttonPadding,
          },
        ]}
        onPress={handleFinalConfirm}
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

  const optionCard = responsive.useTwoPane ? (
    <ScrollView
      style={[
        styles.optionCard,
        {
          padding:
            responsive.cardPadding,
          borderRadius:
            responsive.cardRadius,
        },
        styles.optionTwoPane,
      ]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: 20,
      }}
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
          Processing order...
        </Text>
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
          'bottom',
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
      marginTop: 4,
    },

    subHeader: {
      fontWeight: '700',
      color: '#666',
      textAlign: 'center',
      marginTop: 6,
    },

    content: {
      flex: 1,
      alignSelf: 'center',
      width: '100%',
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
    },

    receiptTwoPane: {
      flex: 1.18,
    },

    receiptItemsList: {
      width: '100%',
    },

    optionCard: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#ddd',
    },

    optionTwoPane: {
      flex: 0.82,
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
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f3f3',
      gap: 12,
    },

    receiptItemLeft: {
      flex: 1,
      paddingRight: 8,
    },

    itemName: {
      fontWeight: '900',
      color: '#333',
    },

    itemUnitPrice: {
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
      fontWeight: '700',
      color: '#666',
      marginTop: 5,
      lineHeight: 20,
    },

    itemSubtotal: {
      fontWeight: '900',
      color: '#f68c45',
      textAlign: 'right',
      maxWidth: 150,
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
      padding: 12,
      color: '#8a4b12',
      fontWeight: '800',
      lineHeight: 20,
      textAlign: 'center',
    },

    optionTitle: {
      fontWeight: '900',
      color: '#333',
      marginBottom: 14,
      textAlign: 'center',
    },

    qrWarningBox: {
      backgroundColor: '#fff4e8',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
    },

    qrWarningText: {
      color: '#8a4b12',
      fontWeight: '800',
      lineHeight: 20,
      textAlign: 'center',
    },

    paymentOption: {
      borderWidth: 1.5,
      borderColor: '#ddd',
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
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
      lineHeight: 19,
    },

    disclaimerBox: {
      backgroundColor: '#fff4e8',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 16,
      padding: 14,
      marginTop: 8,
    },

    disclaimerTitle: {
      fontWeight: '900',
      color: '#8a4b12',
      marginBottom: 4,
    },

    disclaimerText: {
      fontWeight: '700',
      color: '#8a4b12',
      lineHeight: 21,
    },

    confirmButton: {
      backgroundColor: '#f68c45',
      borderRadius: 16,
      alignItems: 'center',
      marginTop: 16,
    },

    confirmButtonText: {
      color: '#fff',
      fontWeight: '900',
    },
  });