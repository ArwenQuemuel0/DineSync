import React, {
  useMemo,
  useState,
} from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';

import {
  placeOrder,
  extractApiErrorMessage,
} from '../api/dinesync';

import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTableStatus } from '../context/TableStatusContext';
import { TABLE_ASSIGNMENT_MESSAGE } from '../constants/tableStatus';

export default function PaymentScreen({
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

  const finalTableNumber =
    routeTableNumber ||
    tableNumber ||
    user?.table_number;

  const {
    cartItems: contextCartItems,
    cartTotal,
    clearCart,
    setActiveOrderId,
    refreshCartInventory,
  } = useCart();

  const cartItems =
    contextCartItems.length > 0
      ? contextCartItems
      : routeCartItems;

  const total =
    contextCartItems.length > 0
      ? cartTotal
      : routeTotal;

  const {
    ensureCanOrder,
    assignmentMessage,
  } = useTableStatus();

  const [loading, setLoading] =
    useState(false);

  const [
    selectedMethod,
    setSelectedMethod,
  ] = useState('Pay at Counter');

  const hasCustomRequest =
    useMemo(() => {
      return cartItems.some((item) => {
        const category =
          String(item?.category || '')
            .trim()
            .toLowerCase();

        const inventoryType =
          String(item?.inventory_type || '')
            .trim()
            .toLowerCase();

        return (
          category === 'chef oppa special' ||
          inventoryType === 'custom'
        );
      });
    }, [cartItems]);

  const handleSelectMethod = (
    method
  ) => {
    if (
      method === 'QR PH' &&
      hasCustomRequest
    ) {
      Alert.alert(
        'QR PH Not Available',
        'Chef Oppa Special requests must be confirmed by staff. QR PH payment is not available for custom requests.'
      );

      return;
    }

    setSelectedMethod(method);
  };

  const handlePayment = async () => {
    if (
      !cartItems ||
      cartItems.length === 0
    ) {
      Alert.alert(
        'Empty Order',
        'There are no items to process.'
      );

      navigation.goBack();

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
      selectedMethod === 'QR PH' &&
      hasCustomRequest
    ) {
      Alert.alert(
        'QR PH Not Available',
        'Chef Oppa Special requests must be confirmed by staff. QR PH payment is not available for custom requests.'
      );

      return;
    }

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
          selectedMethod
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

      if (selectedMethod === 'QR PH') {
        if (!invoiceUrl) {
          Alert.alert(
            'Payment Error',
            'No Xendit invoice URL was returned. Please contact restaurant staff.'
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
        'Payment failed:',
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

  const renderMethod = ({
    method,
    icon,
    disabled = false,
  }) => {
    const active =
      selectedMethod === method;

    return (
      <TouchableOpacity
        style={[
          styles.methodCard,
          active &&
            styles.methodCardActive,
          disabled &&
            styles.methodCardDisabled,
        ]}
        disabled={disabled}
        onPress={() =>
          handleSelectMethod(method)
        }
      >
        <Text style={styles.methodIcon}>
          {icon}
        </Text>

        <Text style={styles.methodText}>
          {method}
        </Text>
      </TouchableOpacity>
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
          Processing Order...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <View style={styles.container}>
        <View style={styles.topRow}>
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

          <Image
            source={require('../../assets/chefoppa_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.header}>
          Payment
        </Text>

        <Text style={styles.subHeader}>
          Select Payment Method
        </Text>

        {hasCustomRequest ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Chef Oppa Special requests must be confirmed by staff. QR PH payment is not available for custom requests.
            </Text>
          </View>
        ) : null}

        <View style={styles.methodRow}>
          {renderMethod({
            method: 'Pay at Counter',
            icon: '💵',
          })}

          {renderMethod({
            method: 'Pay Later',
            icon: '🧾',
          })}

          {renderMethod({
            method: 'QR PH',
            icon: '📱',
            disabled: hasCustomRequest,
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.totalText}>
            Total: ₱
            {Number(total || 0).toFixed(2)}
          </Text>

          <TouchableOpacity
            style={styles.payNowBtn}
            onPress={handlePayment}
          >
            <Text style={styles.payNowText}>
              Confirm Order
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          Once confirmed, the order cannot be cancelled or changed.
        </Text>
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
      padding: 32,
    },

    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    backText: {
      fontSize: 28,
      color: '#3b3b3b',
      fontWeight: '700',
    },

    tableText: {
      fontSize: 24,
      color: '#3b3b3b',
      fontWeight: '900',
    },

    logo: {
      width: 80,
      height: 80,
    },

    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#efefef',
    },

    loadingText: {
      marginTop: 10,
      fontSize: 20,
      fontWeight: '700',
    },

    header: {
      fontSize: 58,
      fontWeight: '800',
      marginTop: 24,
      textAlign: 'center',
      color: '#f68c45',
    },

    subHeader: {
      fontSize: 34,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 22,
      fontWeight: '700',
      color: '#444',
    },

    warningBox: {
      alignSelf: 'center',
      width: '86%',
      maxWidth: 980,
      backgroundColor: '#fff3e8',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 18,
      marginBottom: 22,
    },

    warningText: {
      fontSize: 18,
      fontWeight: '800',
      color: '#7a3f09',
      textAlign: 'center',
      lineHeight: 25,
    },

    methodRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 10,
      flexWrap: 'wrap',
      gap: 20,
    },

    methodCard: {
      borderWidth: 1.5,
      borderColor: '#f0b287',
      borderRadius: 22,
      width: 260,
      height: 245,
      backgroundColor: '#f8f8f8',
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 8,
    },

    methodCardActive: {
      backgroundColor: '#fff3e8',
      borderColor: '#f68c45',
      borderWidth: 2,
    },

    methodCardDisabled: {
      opacity: 0.4,
      backgroundColor: '#dddddd',
    },

    methodIcon: {
      fontSize: 82,
      marginBottom: 18,
    },

    methodText: {
      fontSize: 30,
      color: '#373737',
      fontWeight: '800',
      textAlign: 'center',
    },

    footer: {
      alignSelf: 'center',
      width: '82%',
      maxWidth: 920,
      marginTop: 38,
      borderWidth: 1,
      borderColor: '#d0d0d0',
      paddingVertical: 24,
      paddingHorizontal: 32,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRadius: 18,
      backgroundColor: '#fafafa',
    },

    totalText: {
      fontWeight: '800',
      fontSize: 38,
      color: '#333',
    },

    payNowBtn: {
      backgroundColor: '#f68c45',
      paddingVertical: 18,
      paddingHorizontal: 40,
      borderRadius: 20,
    },

    payNowText: {
      color: '#fff',
      fontSize: 24,
      fontWeight: '800',
    },

    disclaimer: {
      marginTop: 18,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '800',
      color: '#666',
    },
  });