import React, {
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
  processPayment,
} from '../api/dinesync';

import { useCart } from '../context/CartContext';

export default function PaymentScreen({
  route,
  navigation,
}) {
  const {
    cartItems = [],
    total = 0,
  } = route.params || {};

  const {
    clearCart,
    setActiveOrderId,
  } = useCart();

  const [loading, setLoading] =
    useState(false);

  const [
    selectedMethod,
    setSelectedMethod,
  ] = useState('Cash');

  const handlePayment = async (
    method
  ) => {
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

    setLoading(true);

    try {
      // =========================
      // CREATE ORDER FIRST
      // =========================

      const orderResponse =
        await placeOrder(
          cartItems
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
        orderResponse.data.id;

      const totalAmount =
        Number(total) || 0;

      // =========================
      // PROCESS PAYMENT
      // =========================

      const paymentData = {
        orderId,
        amount: totalAmount,
        paymentMethod: method,
      };

      const paymentResponse =
        await processPayment(
          paymentData
        );

        if (
          paymentResponse.success
        ) {
          clearCart();
        
          setActiveOrderId(orderId);
        
          navigation.navigate(
            'OrderStatus',
            { orderId }
          );
        } else {
        Alert.alert(
          'Payment Failed',
          paymentResponse.message ||
            'Payment failed. Please try again.'
        );
      }
    } catch (error) {
      console.error(
        'Payment failed:',
        error
      );

      Alert.alert(
        'Payment Failed',
        error.response?.data?.message ||
          error.message ||
          'Payment failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View
        style={styles.loadingContainer}
      >
        <ActivityIndicator
          size="large"
          color="#FF6347"
        />

        <Text
          style={styles.loadingText}
        >
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
          Payment Methods
        </Text>

        <View style={styles.methodRow}>
          <TouchableOpacity
            style={[
              styles.methodCard,
              selectedMethod ===
                'Cash' &&
                styles.methodCardActive,
            ]}
            onPress={() =>
              setSelectedMethod(
                'Cash'
              )
            }
          >
            <Text
              style={styles.methodIcon}
            >
              💵
            </Text>

            <Text
              style={styles.methodText}
            >
              Cash
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodCard,
              selectedMethod ===
                'QR PH' &&
                styles.methodCardActive,
            ]}
            onPress={() =>
              setSelectedMethod(
                'QR PH'
              )
            }
          >
            <Text
              style={styles.methodIcon}
            >
              📱
            </Text>

            <Text
              style={styles.methodText}
            >
              QR PH
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.totalText}>
            Total: ₱
            {Number(total || 0).toFixed(2)}
          </Text>

          <TouchableOpacity
            style={styles.payNowBtn}
            onPress={() =>
              handlePayment(
                selectedMethod
              )
            }
          >
            <Text
              style={styles.payNowText}
            >
              Pay Now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    frame: {
      flex: 1,
      backgroundColor:
        '#171717',
    },

    container: {
      flex: 1,
      backgroundColor:
        '#efefef',
      padding: 32,
    },

    topRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    backText: {
      fontSize: 28,
      color: '#3b3b3b',
      fontWeight: '700',
    },

    logo: {
      width: 80,
      height: 80,
    },

    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor:
        '#efefef',
    },

    loadingText: {
      marginTop: 10,
      fontSize: 20,
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
      marginBottom: 34,
      fontWeight: '700',
      color: '#444',
    },

    methodRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 10,
    },

    methodCard: {
      borderWidth: 1.5,
      borderColor: '#f0b287',
      borderRadius: 22,
      width: 300,
      height: 300,
      backgroundColor:
        '#f8f8f8',
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 20,
    },

    methodCardActive: {
      backgroundColor:
        '#fff3e8',
      borderColor: '#f68c45',
      borderWidth: 2,
    },

    methodIcon: {
      fontSize: 100,
      marginBottom: 18,
    },

    methodText: {
      fontSize: 42,
      color: '#373737',
      fontWeight: '700',
    },

    footer: {
      alignSelf: 'center',
      width: '82%',
      maxWidth: 920,
      marginTop: 42,
      borderWidth: 1,
      borderColor: '#d0d0d0',
      paddingVertical: 24,
      paddingHorizontal: 32,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      borderRadius: 18,
      backgroundColor:
        '#fafafa',
    },

    totalText: {
      fontWeight: '800',
      fontSize: 42,
      color: '#333',
    },

    payNowBtn: {
      backgroundColor:
        '#f68c45',
      paddingVertical: 18,
      paddingHorizontal: 40,
      borderRadius: 20,
    },

    payNowText: {
      color: '#fff',
      fontSize: 26,
      fontWeight: '800',
    },
  });