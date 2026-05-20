import React, {
    useEffect,
    useState,
  } from 'react';
  
  import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    Alert,
  } from 'react-native';
  
  import { getTableOrderHistory } from '../api/dinesync';
  import { useAuth } from '../context/AuthContext';
  
  export default function OrderHistoryScreen({
    navigation,
  }) {
    const { tableNumber } = useAuth();
  
    const [orders, setOrders] =
      useState([]);
  
    const [loading, setLoading] =
      useState(true);
  
    const [refreshing, setRefreshing] =
      useState(false);
  
    useEffect(() => {
      fetchOrderHistory();
    }, []);
  
    const fetchOrderHistory = async () => {
      try {
        setLoading(true);
  
        const response =
          await getTableOrderHistory();
  
        console.log(
          'ORDER HISTORY RESPONSE:',
          response
        );
  
        if (response.success) {
          setOrders(response.data || []);
        } else {
          Alert.alert(
            'Error',
            response.message ||
              'Failed to load order history.'
          );
        }
      } catch (error) {
        console.log(
          'ORDER HISTORY ERROR:',
          error?.response?.data ||
            error.message
        );
  
        Alert.alert(
          'Error',
          'Unable to load order history.'
        );
      } finally {
        setLoading(false);
      }
    };
  
    const handleRefresh = async () => {
      try {
        setRefreshing(true);
  
        const response =
          await getTableOrderHistory();
  
        if (response.success) {
          setOrders(response.data || []);
        }
      } catch (error) {
        console.log(
          'REFRESH ORDER HISTORY ERROR:',
          error?.response?.data ||
            error.message
        );
      } finally {
        setRefreshing(false);
      }
    };
  
    const formatMoney = (value) => {
      const number = Number(value);
  
      return Number.isFinite(number)
        ? number.toFixed(2)
        : '0.00';
    };
  
    const formatDateTime = (value) => {
      if (!value) {
        return '-';
      }
  
      const date = new Date(value);
  
      if (Number.isNaN(date.getTime())) {
        return '-';
      }
  
      return date.toLocaleString();
    };
  
    const getOrderTotal = (order) => {
      return (
        order.total_amount ||
        order.total ||
        order.amount ||
        0
      );
    };
  
    const getOrderItems = (order) => {
      return (
        order.items ||
        order.order_items ||
        []
      );
    };
  
    const getItemName = (item) => {
      return (
        item.name ||
        item.menu_item?.name ||
        item.menu_items?.name ||
        'Menu Item'
      );
    };
  
    const getItemPrice = (item) => {
      return Number(
        item.price ||
          item.menu_item?.price ||
          item.menu_items?.price ||
          0
      );
    };
  
    const getItemQuantity = (item) => {
      return Number(
        item.quantity || 0
      );
    };
  
    const getStatusLabel = (status) => {
      const normalized =
        String(status || 'pending')
          .toLowerCase();
  
      if (normalized === 'pending') {
        return 'Waiting for Kitchen';
      }
  
      if (normalized === 'preparing') {
        return 'Preparing';
      }
  
      if (normalized === 'ready') {
        return 'Ready to Serve';
      }
  
      if (
        normalized === 'served' ||
        normalized === 'completed'
      ) {
        return 'Served';
      }
  
      if (normalized === 'cancelled') {
        return 'Cancelled';
      }
  
      return status || 'Pending';
    };
  
    const renderOrderItem = ({
      item,
    }) => {
      const price =
        getItemPrice(item);
  
      const quantity =
        getItemQuantity(item);
  
      const subtotal =
        price * quantity;
  
      return (
        <View style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>
              {getItemName(item)}
            </Text>
  
            <Text style={styles.itemDetails}>
              Qty: {quantity} × ₱
              {formatMoney(price)}
            </Text>
          </View>
  
          <Text style={styles.itemSubtotal}>
            ₱{formatMoney(subtotal)}
          </Text>
        </View>
      );
    };
  
    const renderBatch = ({
      item: order,
      index,
    }) => {
      const items =
        getOrderItems(order);
  
      return (
        <View style={styles.batchCard}>
          <View style={styles.batchHeader}>
            <View>
              <Text style={styles.batchTitle}>
                Batch {index + 1}
              </Text>
  
              <Text style={styles.orderNumber}>
                {order.order_number
                  ? order.order_number
                  : `Order ID: ${order.id}`}
              </Text>
            </View>
  
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>
                {getStatusLabel(
                  order.status
                )}
              </Text>
            </View>
          </View>
  
          <Text style={styles.createdText}>
            Created:{' '}
            {formatDateTime(
              order.created_at
            )}
          </Text>
  
          <View style={styles.divider} />
  
          {items.length === 0 ? (
            <Text style={styles.noItemsText}>
              No items found for this order.
            </Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(
                item,
                itemIndex
              ) =>
                String(
                  item.id ||
                    item.menu_item_id ||
                    itemIndex
                )
              }
              renderItem={renderOrderItem}
              scrollEnabled={false}
            />
          )}
  
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Total Amount
            </Text>
  
            <Text style={styles.totalValue}>
              ₱
              {formatMoney(
                getOrderTotal(order)
              )}
            </Text>
          </View>
        </View>
      );
    };
  
    if (loading) {
      return (
        <View style={styles.frame}>
          <View style={styles.container}>
            <ActivityIndicator
              size="large"
              color="#f68c45"
            />
  
            <Text style={styles.loadingText}>
              Loading order history...
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
                navigation.goBack()
              }
            >
              <Text style={styles.backText}>
                {'<'} Go Back
              </Text>
            </TouchableOpacity>
  
            <Text style={styles.title}>
              Order History
            </Text>
  
            <Text style={styles.tableText}>
              Table {tableNumber || '-'}
            </Text>
          </View>
  
          {orders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>
                🧾
              </Text>
  
              <Text style={styles.emptyTitle}>
                No orders yet for this table session.
              </Text>
  
              <Text style={styles.emptyText}>
                Orders placed from this tablet will appear here after they are submitted.
              </Text>
  
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={fetchOrderHistory}
              >
                <Text style={styles.refreshButtonText}>
                  Refresh
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(
                order,
                index
              ) =>
                String(
                  order.id || index
                )
              }
              renderItem={renderBatch}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.listContent
              }
            />
          )}
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
      },
  
      topBar: {
        height: 76,
        backgroundColor: '#b8b3b3',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
      },
  
      backText: {
        color: '#fff',
        fontSize: 26,
        fontWeight: '800',
      },
  
      title: {
        color: '#fff',
        fontSize: 30,
        fontWeight: '900',
      },
  
      tableText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '900',
      },
  
      loadingText: {
        marginTop: 16,
        fontSize: 22,
        fontWeight: '800',
        color: '#555',
      },
  
      listContent: {
        padding: 24,
        paddingBottom: 40,
      },
  
      batchCard: {
        backgroundColor: '#fff',
        borderRadius: 22,
        padding: 22,
        marginBottom: 18,
        borderWidth: 1.5,
        borderColor: '#f0b287',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
      },
  
      batchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      },
  
      batchTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#333',
      },
  
      orderNumber: {
        marginTop: 4,
        fontSize: 17,
        fontWeight: '800',
        color: '#777',
      },
  
      statusPill: {
        backgroundColor: '#fff3e8',
        borderColor: '#f68c45',
        borderWidth: 1.5,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
      },
  
      statusText: {
        color: '#f68c45',
        fontSize: 15,
        fontWeight: '900',
      },
  
      createdText: {
        marginTop: 12,
        fontSize: 15,
        fontWeight: '700',
        color: '#777',
      },
  
      divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 16,
      },
  
      itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f1f1',
      },
  
      itemInfo: {
        flex: 1,
        paddingRight: 14,
      },
  
      itemName: {
        fontSize: 18,
        fontWeight: '900',
        color: '#333',
      },
  
      itemDetails: {
        marginTop: 4,
        fontSize: 15,
        fontWeight: '700',
        color: '#777',
      },
  
      itemSubtotal: {
        fontSize: 17,
        fontWeight: '900',
        color: '#f68c45',
      },
  
      noItemsText: {
        fontSize: 16,
        color: '#777',
        fontWeight: '700',
        textAlign: 'center',
        paddingVertical: 10,
      },
  
      totalRow: {
        marginTop: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fafafa',
        borderRadius: 14,
        padding: 16,
      },
  
      totalLabel: {
        fontSize: 20,
        fontWeight: '900',
        color: '#333',
      },
  
      totalValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#f68c45',
      },
  
      emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
      },
  
      emptyIcon: {
        fontSize: 90,
        marginBottom: 18,
      },
  
      emptyTitle: {
        fontSize: 30,
        fontWeight: '900',
        color: '#333',
        textAlign: 'center',
      },
  
      emptyText: {
        marginTop: 12,
        fontSize: 19,
        fontWeight: '700',
        color: '#777',
        textAlign: 'center',
        maxWidth: 620,
        lineHeight: 28,
      },
  
      refreshButton: {
        marginTop: 28,
        backgroundColor: '#f68c45',
        paddingVertical: 16,
        paddingHorizontal: 34,
        borderRadius: 14,
      },
  
      refreshButtonText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '900',
      },
    });