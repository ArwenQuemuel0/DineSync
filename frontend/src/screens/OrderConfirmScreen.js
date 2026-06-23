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
  FlatList,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
} from 'react-native';

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

  const {
    width,
    height,
  } = useWindowDimensions();

  const isLandscape =
    width > height;

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
    useState('Pay at Counter');

  const [loading, setLoading] =
    useState(false);

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
      setSelectedPayment('Pay at Counter');
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

  const paymentOptions = [
    {
      label: 'Pay at Counter',
      description:
        'Confirm your order now and pay at the cashier counter.',
      disabled: false,
    },
    {
      label: 'Pay Later',
      description:
        'Send your order to the kitchen and settle payment later with staff.',
      disabled: false,
    },
    {
      label: 'QR PH',
      description:
        hasCustomRequest
          ? 'Not available for Chef Oppa Special requests because the price must be confirmed by staff.'
          : 'Pay online using the Xendit QR PH checkout link.',
      disabled: hasCustomRequest,
    },
  ];

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

    if (
      hasCustomRequest &&
      selectedPayment === 'QR PH'
    ) {
      Alert.alert(
        'QR PH Not Available',
        'Chef Oppa Special requests must be confirmed by staff. QR PH payment is not available for custom requests.'
      );

      return;
    }

    Alert.alert(
      'Confirm Order',
      'Please review your order carefully. Once confirmed, your order will be sent to the kitchen and can no longer be cancelled or changed.',
      [
        {
          text: 'Go Back',
          style: 'cancel',
        },
        {
          text: 'Confirm Order',
          style: 'destructive',
          onPress: submitOrder,
        },
      ]
    );
  };

  const submitOrder = async () => {
    setLoading(true);

    try {
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
          selectedPayment
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

      clearCart();

      setActiveOrderId(orderId);

      if (selectedPayment === 'QR PH') {
        if (!invoiceUrl) {
          Alert.alert(
            'Payment Error',
            'No payment link was returned. Please ask restaurant staff for help.'
          );

          navigation.replace(
            'OrderStatus',
            { orderId }
          );

          return;
        }

        navigation.replace(
          'PaymentWebView',
          {
            orderId,
            invoiceUrl,
          }
        );

        return;
      }

      navigation.replace(
        'OrderStatus',
        { orderId }
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

  const renderReceiptItem = ({
    item,
  }) => {
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

    return (
      <View style={styles.receiptItem}>
        <View style={styles.receiptItemLeft}>
          <Text
            style={styles.itemName}
            numberOfLines={2}
          >
            {quantity}x {item.name}
          </Text>

          {customItem ? (
            <>
              <Text style={styles.customPriceText}>
                Price: To be confirmed
              </Text>

              {requestText ? (
                <Text style={styles.requestText}>
                  Request: {requestText}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.itemUnitPrice}>
              ₱{formatMoney(price)} each
            </Text>
          )}
        </View>

        <Text style={styles.itemSubtotal}>
          {customItem
            ? 'To be confirmed'
            : `₱${formatMoney(subtotal)}`}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#f68c45"
        />

        <Text style={styles.loadingText}>
          Sending order to kitchen...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() =>
              navigation.goBack()
            }
          >
            <Text style={styles.backText}>
              {'<'} Go Back
            </Text>
          </TouchableOpacity>

          <Text style={styles.tableText}>
            Table {finalTableNumber || '-'}
          </Text>
        </View>

        <Text style={styles.header}>
          Confirm Order
        </Text>

        <Text style={styles.subHeader}>
          Review your order before sending it to the kitchen.
        </Text>

        <View
          style={[
            styles.content,
            isLandscape
              ? styles.contentLandscape
              : styles.contentPortrait,
          ]}
        >
          <View
            style={[
              styles.receiptCard,
              isLandscape
                ? styles.receiptLandscape
                : styles.receiptPortrait,
            ]}
          >
            <Text style={styles.receiptTitle}>
              Order Summary
            </Text>

            <Text style={styles.receiptTable}>
              Table {finalTableNumber || '-'}
            </Text>

            <View style={styles.receiptDivider} />

            <FlatList
              data={cartItems}
              keyExtractor={(item, index) =>
                String(
                  item.menu_item_id ||
                    item.id ||
                    index
                )
              }
              renderItem={renderReceiptItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 12,
              }}
            />

            <View style={styles.receiptDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Total Items
              </Text>

              <Text style={styles.summaryValue}>
                {totalItems}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.grandTotalLabel}>
                Total Amount
              </Text>

              <Text style={styles.grandTotalValue}>
                ₱{formatMoney(total)}
              </Text>
            </View>

            {hasCustomRequest ? (
              <Text style={styles.customNotice}>
                Chef Oppa Special requests are not included in the total yet. Final price and availability will be confirmed by staff.
              </Text>
            ) : null}
          </View>

          <ScrollView
            style={[
              styles.optionCard,
              isLandscape
                ? styles.optionLandscape
                : styles.optionPortrait,
            ]}
            contentContainerStyle={{
              paddingBottom: 20,
            }}
          >
            <Text style={styles.optionTitle}>
              Payment Option
            </Text>

            {hasCustomRequest ? (
              <View style={styles.qrWarningBox}>
                <Text style={styles.qrWarningText}>
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
                      active &&
                        styles.paymentOptionTitleActive,
                      option.disabled &&
                        styles.paymentOptionTitleDisabled,
                    ]}
                  >
                    {option.label}
                  </Text>

                  <Text style={styles.paymentOptionDesc}>
                    {option.description}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerTitle}>
                Disclaimer
              </Text>

              <Text style={styles.disclaimerText}>
                Once confirmed, the order cannot be cancelled or changed.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleFinalConfirm}
            >
              <Text style={styles.confirmButtonText}>
                Confirm Order
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    frame: {
      flex: 1,
      backgroundColor: '#171717',
    },

    container: {
      flex: 1,
      backgroundColor: '#efefef',
      padding: 22,
    },

    loadingContainer: {
      flex: 1,
      backgroundColor: '#efefef',
      justifyContent: 'center',
      alignItems: 'center',
    },

    loadingText: {
      marginTop: 12,
      fontSize: 20,
      fontWeight: '800',
      color: '#333',
    },

    topBar: {
      height: 58,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    backText: {
      fontSize: 24,
      fontWeight: '900',
      color: '#333',
    },

    tableText: {
      fontSize: 24,
      fontWeight: '900',
      color: '#f68c45',
    },

    header: {
      fontSize: 46,
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
      marginTop: 4,
    },

    subHeader: {
      fontSize: 18,
      fontWeight: '700',
      color: '#666',
      textAlign: 'center',
      marginTop: 6,
      marginBottom: 18,
    },

    content: {
      flex: 1,
      gap: 18,
    },

    contentLandscape: {
      flexDirection: 'row',
    },

    contentPortrait: {
      flexDirection: 'column',
    },

    receiptCard: {
      backgroundColor: '#fff',
      borderRadius: 22,
      padding: 22,
      borderWidth: 1.5,
      borderColor: '#f0b287',
    },

    receiptLandscape: {
      flex: 1.25,
    },

    receiptPortrait: {
      flex: 1,
      minHeight: 360,
    },

    optionCard: {
      backgroundColor: '#fff',
      borderRadius: 22,
      padding: 22,
      borderWidth: 1,
      borderColor: '#ddd',
    },

    optionLandscape: {
      flex: 0.85,
    },

    optionPortrait: {
      maxHeight: 430,
    },

    receiptTitle: {
      fontSize: 30,
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
    },

    receiptTable: {
      fontSize: 18,
      fontWeight: '800',
      color: '#777',
      textAlign: 'center',
      marginTop: 4,
    },

    receiptDivider: {
      height: 1,
      backgroundColor: '#eee',
      marginVertical: 16,
    },

    receiptItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f3f3',
      gap: 12,
    },

    receiptItemLeft: {
      flex: 1,
      paddingRight: 12,
    },

    itemName: {
      fontSize: 19,
      fontWeight: '900',
      color: '#333',
    },

    itemUnitPrice: {
      fontSize: 14,
      fontWeight: '700',
      color: '#777',
      marginTop: 3,
    },

    customPriceText: {
      fontSize: 14,
      fontWeight: '900',
      color: '#f68c45',
      marginTop: 4,
    },

    requestText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#666',
      marginTop: 5,
      lineHeight: 20,
    },

    itemSubtotal: {
      fontSize: 18,
      fontWeight: '900',
      color: '#f68c45',
      textAlign: 'right',
      maxWidth: 150,
    },

    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },

    summaryLabel: {
      fontSize: 18,
      fontWeight: '800',
      color: '#555',
    },

    summaryValue: {
      fontSize: 20,
      fontWeight: '900',
      color: '#333',
    },

    grandTotalLabel: {
      fontSize: 23,
      fontWeight: '900',
      color: '#333',
    },

    grandTotalValue: {
      fontSize: 28,
      fontWeight: '900',
      color: '#f68c45',
    },

    customNotice: {
      marginTop: 14,
      backgroundColor: '#fff4e8',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 12,
      padding: 12,
      color: '#8a4b12',
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 20,
      textAlign: 'center',
    },

    optionTitle: {
      fontSize: 26,
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
      fontSize: 14,
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
      fontSize: 20,
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
      fontSize: 14,
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
      fontSize: 18,
      fontWeight: '900',
      color: '#8a4b12',
      marginBottom: 4,
    },

    disclaimerText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#8a4b12',
      lineHeight: 21,
    },

    confirmButton: {
      backgroundColor: '#f68c45',
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 16,
    },

    confirmButtonText: {
      color: '#fff',
      fontSize: 20,
      fontWeight: '900',
    },
  });