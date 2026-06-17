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
  FlatList,
} from 'react-native';

import {
  CommonActions,
} from '@react-navigation/native';

import {
  getTableOrderHistory,
  getOrderStatus,
} from '../api/dinesync';

import { useAuth } from '../context/AuthContext';
import { useTableStatus } from '../context/TableStatusContext';

import {
  normalizeOrderStatus,
  getOrderStatusLabel,
  isActiveOrderStatus,
  normalizePaymentStatus,
  getPaymentStatusLabel,
} from '../utils/orderStatus';

export default function OrderStatusScreen({
  route,
  navigation,
}) {
  const {
    orderId,
  } = route.params || {};

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
    fetchOrders();

    const interval =
      setInterval(() => {
        fetchOrders(false);
      }, 5000);

    return () =>
      clearInterval(interval);
  }, [finalTableNumber, orderId]);

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
        await getTableOrderHistory();

      if (response.success) {
        const activeOrders = (
          response.data || []
        ).filter((order) =>
          isActiveOrderStatus(
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

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }

    return date.toLocaleString();
  };

  const normalizePaymentMethod = (
    value
  ) => {
    const normalized =
      String(
        value || 'Pay at Counter'
      )
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');

    if (
      normalized === 'qr ph' ||
      normalized === 'qrph' ||
      normalized === 'xendit' ||
      normalized === 'online payment'
    ) {
      return 'QR PH';
    }

    if (
      normalized === 'pay later' ||
      normalized === 'later'
    ) {
      return 'Pay Later';
    }

    return 'Pay at Counter';
  };

  const getStatusStyle = (
    status
  ) => {
    const normalized =
      normalizeOrderStatus(status);

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
      normalizeOrderStatus(
        order.status
      );

    const paymentMethod =
      normalizePaymentMethod(
        order.payment_method
      );

    if (
      paymentStatus === 'paid' &&
      orderStatus === 'pending'
    ) {
      return 'Payment received. Your order is now in queue.';
    }

    if (paymentStatus === 'expired') {
      return 'Payment expired. Please ask restaurant staff for help.';
    }

    if (paymentStatus === 'failed') {
      return 'Payment failed. Please try again or ask restaurant staff for help.';
    }

    if (paymentMethod === 'Pay at Counter') {
      return 'Your order has been sent to the kitchen. Please pay at the counter.';
    }

    if (paymentMethod === 'Pay Later') {
      return 'Your order has been sent to the kitchen. Payment will be settled later with staff.';
    }

    if (
      paymentMethod === 'QR PH' &&
      paymentStatus === 'pending'
    ) {
      return 'QR PH payment is still being processed.';
    }

    return '';
  };

  const getPaymentLabel = (
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

    if (
      paymentMethod === 'Pay at Counter' &&
      paymentStatus === 'pending'
    ) {
      return 'Pay at Counter';
    }

    if (
      paymentMethod === 'Pay Later' &&
      paymentStatus === 'pending'
    ) {
      return 'Pay Later';
    }

    return getPaymentStatusLabel(
      order.payment_status
    );
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

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.orderTitle}>
              {item.order_number
                ? item.order_number
                : `Order #${item.id}`}
            </Text>

            <Text style={styles.orderDate}>
              {formatDateTime(
                item.created_at
              )}
            </Text>
          </View>

          <View style={styles.orderHeaderRight}>
            <View
              style={[
                styles.statusBadge,
                getStatusStyle(
                  item.status
                ),
              ]}
            >
              <Text
                style={
                  styles.statusBadgeText
                }
              >
                {getOrderStatusLabel(
                  item.status
                )}
              </Text>
            </View>

            <View
              style={[
                styles.paymentBadge,
                getPaymentStatusStyle(
                  item.payment_status
                ),
              ]}
            >
              <Text
                style={
                  styles.paymentBadgeText
                }
              >
                {getPaymentLabel(item)}
              </Text>
            </View>
          </View>
        </View>

        {paymentMessage ? (
          <Text style={styles.paymentMessage}>
            {paymentMessage}
          </Text>
        ) : null}

        <View style={styles.divider} />

        {items.length === 0 ? (
          <Text style={styles.noItemsText}>
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

              const quantity =
                Number(
                  orderItem.quantity ||
                    0
                );

              const price =
                Number(
                  orderItem.price ||
                    orderItem.menu_item
                      ?.price ||
                    0
                );

              return (
                <View
                  key={`${item.id}-${index}`}
                  style={styles.itemRow}
                >
                  <View style={styles.itemLeft}>
                    <Text
                      style={
                        styles.itemName
                      }
                      numberOfLines={2}
                    >
                      {name}
                    </Text>

                    <Text
                      style={
                        styles.itemQty
                      }
                    >
                      Qty: {quantity}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.itemPrice
                    }
                  >
                    ₱
                    {formatMoney(
                      price *
                        quantity
                    )}
                  </Text>
                </View>
              );
            }
          )
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Total
          </Text>

          <Text style={styles.totalValue}>
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#f68c45"
          />

          <Text style={styles.loadingText}>
            Loading active orders...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate(
                'Menu'
              )
            }
          >
            <Text style={styles.backText}>
              {'<'} Back to Menu
            </Text>
          </TouchableOpacity>

          <Text style={styles.tableText}>
            Table {finalTableNumber || '-'}
          </Text>
        </View>

        <Text style={styles.header}>
          Order Status
        </Text>

        <Text style={styles.subHeader}>
          {orderId
            ? `Order #${orderId}`
            : 'Active Orders'}
        </Text>

        {error ? (
          <Text style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        {orders.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>
              🧾
            </Text>

            <Text style={styles.emptyTitle}>
              No Active Orders
            </Text>

            <Text style={styles.emptyText}>
              Pending, preparing, and ready orders will appear here. Served orders move to order history.
            </Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) =>
              String(item.id)
            }
            renderItem={renderOrderItem}
            showsVerticalScrollIndicator={
              false
            }
            contentContainerStyle={{
              paddingBottom: 120,
            }}
          />
        )}

        <View style={styles.bottomBar}>
          <Text style={styles.autoText}>
            Updates every 5 seconds
          </Text>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() =>
              fetchOrders(true)
            }
          >
            <Text style={styles.refreshText}>
              Refresh
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() =>
              navigation.navigate(
                'Menu'
              )
            }
          >
            <Text style={styles.menuText}>
              Continue Ordering
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
      backgroundColor: '#171717',
    },

    container: {
      flex: 1,
      backgroundColor: '#efefef',
      padding: 24,
    },

    loadingContainer: {
      flex: 1,
      backgroundColor: '#efefef',
      justifyContent: 'center',
      alignItems: 'center',
    },

    topBar: {
      height: 64,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    backText: {
      fontSize: 24,
      fontWeight: '800',
      color: '#333',
    },

    tableText: {
      fontSize: 24,
      fontWeight: '900',
      color: '#f68c45',
    },

    header: {
      fontSize: 52,
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
      marginTop: 8,
    },

    subHeader: {
      fontSize: 26,
      fontWeight: '800',
      color: '#666',
      textAlign: 'center',
      marginBottom: 20,
    },

    loadingText: {
      marginTop: 16,
      fontSize: 22,
      fontWeight: '700',
      color: '#555',
    },

    errorText: {
      backgroundColor: '#ffe5e5',
      color: '#b00020',
      padding: 12,
      borderRadius: 12,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 12,
    },

    orderCard: {
      backgroundColor: '#fff',
      borderRadius: 22,
      padding: 22,
      marginBottom: 18,
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
    },

    orderHeaderLeft: {
      flex: 1,
      paddingRight: 14,
    },

    orderTitle: {
      fontSize: 26,
      fontWeight: '900',
      color: '#333',
    },

    orderDate: {
      marginTop: 4,
      fontSize: 15,
      fontWeight: '700',
      color: '#888',
    },

    statusBadge: {
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 999,
    },

    orderHeaderRight: {
      alignItems: 'flex-end',
    },

    paymentBadge: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 999,
      marginTop: 8,
    },

    paymentBadgeText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#333',
    },

    paymentMessage: {
      marginTop: 14,
      backgroundColor: '#fff3e8',
      color: '#333',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 22,
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

    statusBadgeText: {
      fontSize: 16,
      fontWeight: '900',
      color: '#333',
    },

    divider: {
      height: 1,
      backgroundColor: '#eee',
      marginVertical: 16,
    },

    noItemsText: {
      fontSize: 16,
      color: '#888',
      fontWeight: '700',
    },

    itemRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#f2f2f2',
    },

    itemLeft: {
      flex: 1,
      paddingRight: 12,
    },

    itemName: {
      fontSize: 19,
      fontWeight: '900',
      color: '#333',
    },

    itemQty: {
      fontSize: 15,
      fontWeight: '700',
      color: '#777',
      marginTop: 3,
    },

    itemPrice: {
      fontSize: 18,
      fontWeight: '900',
      color: '#f68c45',
    },

    totalRow: {
      marginTop: 16,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    totalLabel: {
      fontSize: 22,
      fontWeight: '900',
      color: '#333',
    },

    totalValue: {
      fontSize: 26,
      fontWeight: '900',
      color: '#f68c45',
    },

    emptyBox: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 100,
    },

    emptyIcon: {
      fontSize: 80,
      marginBottom: 16,
    },

    emptyTitle: {
      fontSize: 36,
      fontWeight: '900',
      color: '#333',
      marginBottom: 8,
    },

    emptyText: {
      fontSize: 18,
      color: '#777',
      fontWeight: '700',
      textAlign: 'center',
    },

    bottomBar: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 20,
      backgroundColor: '#fff',
      borderRadius: 18,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      borderWidth: 1,
      borderColor: '#ddd',
    },

    autoText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#777',
    },

    refreshBtn: {
      backgroundColor: '#333',
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: 12,
    },

    refreshText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '900',
    },

    menuBtn: {
      backgroundColor: '#f68c45',
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: 12,
    },

    menuText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '900',
    },
  });