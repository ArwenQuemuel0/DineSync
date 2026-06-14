import React from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { WebView } from 'react-native-webview';

export default function PaymentWebViewScreen({
  route,
  navigation,
}) {
  const {
    orderId,
    invoiceUrl,
  } = route.params || {};

  if (!invoiceUrl) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>
          Payment Error
        </Text>

        <Text style={styles.errorText}>
          No payment link was provided.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            navigation.replace(
              'OrderStatus',
              { orderId }
            )
          }
        >
          <Text style={styles.buttonText}>
            Go to Order Status
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleNavigationChange = (
    navState
  ) => {
    const currentUrl =
      navState.url || '';

    console.log(
      'PAYMENT WEBVIEW URL:',
      currentUrl
    );

    const isSuccess =
      currentUrl.includes(
        'payment-success'
      );

    const isFailed =
      currentUrl.includes(
        'payment-failed'
      ) ||
      currentUrl.includes(
        'payment-cancel'
      ) ||
      currentUrl.includes(
        'failure'
      );

    if (isSuccess) {
      navigation.replace(
        'OrderStatus',
        { orderId }
      );

      return;
    }

    if (isFailed) {
      Alert.alert(
        'Payment Status',
        'Payment was not completed. You can check the order status or ask restaurant staff for help.'
      );

      navigation.replace(
        'OrderStatus',
        { orderId }
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            navigation.replace(
              'OrderStatus',
              { orderId }
            )
          }
        >
          <Text style={styles.closeText}>
            Close
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          Complete Payment
        </Text>

        <View style={styles.spacer} />
      </View>

      <WebView
        source={{
          uri: invoiceUrl,
        }}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        onNavigationStateChange={
          handleNavigationChange
        }
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color="#f68c45"
            />

            <Text style={styles.loadingText}>
              Loading payment page...
            </Text>
          </View>
        )}
        onError={() => {
          Alert.alert(
            'Payment Page Error',
            'Unable to load the payment page. Please check your connection.'
          );
        }}
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#efefef',
    },

    header: {
      height: 72,
      paddingHorizontal: 20,
      backgroundColor: '#ffffff',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: '#ddd',
    },

    closeText: {
      fontSize: 20,
      fontWeight: '800',
      color: '#f68c45',
    },

    title: {
      fontSize: 22,
      fontWeight: '900',
      color: '#333',
    },

    spacer: {
      width: 55,
    },

    loadingContainer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#efefef',
      alignItems: 'center',
      justifyContent: 'center',
    },

    loadingText: {
      marginTop: 12,
      fontSize: 18,
      color: '#333',
      fontWeight: '600',
    },

    errorContainer: {
      flex: 1,
      backgroundColor: '#efefef',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 30,
    },

    errorTitle: {
      fontSize: 34,
      fontWeight: '900',
      color: '#f68c45',
      marginBottom: 12,
    },

    errorText: {
      fontSize: 20,
      color: '#333',
      textAlign: 'center',
      marginBottom: 24,
    },

    button: {
      backgroundColor: '#f68c45',
      paddingVertical: 16,
      paddingHorizontal: 28,
      borderRadius: 16,
    },

    buttonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '800',
    },
  });