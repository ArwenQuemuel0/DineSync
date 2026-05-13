import React, {
  useEffect,
  useState,
} from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { getOrderStatus } from '../api/dinesync';

export default function OrderStatusScreen({
  route,
  navigation,
}) {
  const { orderId } =
    route.params || {};

  const [order, setOrder] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  useEffect(() => {
    fetchOrderStatus();

    const interval = setInterval(() => {
      fetchOrderStatus(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrderStatus = async (
    showLoading = true
  ) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      if (!orderId) {
        setError('No order ID found.');
        return;
      }

      const response =
        await getOrderStatus(orderId);

      if (response.success) {
        setOrder(response.data);
        setError('');
      } else {
        setError(
          response.message ||
            'Failed to get order status.'
        );
      }
    } catch (err) {
      console.log(
        'ORDER STATUS ERROR:',
        err
      );

      setError(
        'Unable to load order status.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = () => {
    const status =
      order?.status || 'Pending';

    const normalized =
      String(status).toLowerCase();

    if (normalized === 'pending') {
      return {
        icon: '✓',
        title: 'Order Placed',
        message:
          'Your order has been received.',
      };
    }

    if (normalized === 'preparing') {
      return {
        icon: '🍳',
        title: 'Preparing',
        message:
          'Your order is now being prepared.',
      };
    }

    if (normalized === 'ready') {
      return {
        icon: '🍽️',
        title: 'Ready',
        message:
          'Your order is ready to be served.',
      };
    }

    if (normalized === 'completed') {
      return {
        icon: '✅',
        title: 'Completed',
        message:
          'Your order has been completed.',
      };
    }

    if (normalized === 'cancelled') {
      return {
        icon: '×',
        title: 'Cancelled',
        message:
          'Your order was cancelled.',
      };
    }

    return {
      icon: '🍽️',
      title: status,
      message:
        'Your order status has been updated.',
    };
  };

  const statusInfo =
    getStatusInfo();

  if (loading) {
    return (
      <View style={styles.frame}>
        <View style={styles.container}>
          <ActivityIndicator
            size="large"
            color="#f68c45"
          />

          <Text style={styles.loadingText}>
            Loading order status...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <View style={styles.container}>
        <View style={styles.statusCircle}>
          <Text style={styles.statusIcon}>
            {statusInfo.icon}
          </Text>
        </View>

        <Text style={styles.header}>
          {statusInfo.title}
        </Text>

        {order?.order_number ? (
          <Text style={styles.orderNumber}>
            {order.order_number}
          </Text>
        ) : orderId ? (
          <Text style={styles.orderNumber}>
            Order ID: {orderId}
          </Text>
        ) : null}

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>
            Current Status
          </Text>

          <Text style={styles.statusText}>
            {order?.status || 'Pending'}
          </Text>
        </View>

        <Text style={styles.subText}>
          {error || statusInfo.message}
        </Text>

        <Text style={styles.autoText}>
          This page updates automatically every 5 seconds.
        </Text>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() =>
            fetchOrderStatus(true)
          }
        >
          <Text style={styles.refreshBtnText}>
            Refresh Status
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() =>
            navigation.navigate('Menu')
          }
        >
          <Text style={styles.homeBtnText}>
            Continue Ordering
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: '#171717',
  },

  container: {
    flex: 1,
    backgroundColor: '#efefef',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },

  statusCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#f68c45',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  statusIcon: {
    color: '#fff',
    fontSize: 94,
    fontWeight: '900',
  },

  header: {
    marginTop: 36,
    fontSize: 64,
    fontWeight: '900',
    color: '#333',
    textAlign: 'center',
  },

  orderNumber: {
    marginTop: 10,
    color: '#555',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },

  statusBox: {
    marginTop: 28,
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#f0b287',
    paddingVertical: 24,
    paddingHorizontal: 60,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  statusLabel: {
    color: '#777',
    fontSize: 22,
    fontWeight: '800',
  },

  statusText: {
    marginTop: 8,
    color: '#f68c45',
    fontSize: 46,
    fontWeight: '900',
  },

  subText: {
    marginTop: 24,
    color: '#555',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },

  autoText: {
    marginTop: 10,
    color: '#999',
    fontSize: 18,
    textAlign: 'center',
  },

  loadingText: {
    marginTop: 18,
    color: '#555',
    fontSize: 22,
    fontWeight: '700',
  },

  refreshBtn: {
    marginTop: 38,
    backgroundColor: '#333',
    paddingVertical: 18,
    paddingHorizontal: 42,
    borderRadius: 16,
  },

  refreshBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },

  homeBtn: {
    marginTop: 18,
    backgroundColor: '#f68c45',
    paddingVertical: 18,
    paddingHorizontal: 42,
    borderRadius: 16,
  },

  homeBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
});