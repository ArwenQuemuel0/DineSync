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
  StatusBar,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  CommonActions,
} from '@react-navigation/native';

import { getTableOrderHistory } from '../api/dinesync';
import { useAuth } from '../context/AuthContext';
import { useTableStatus } from '../context/TableStatusContext';
import { getOrderStatusLabel } from '../utils/orderStatus';

export default function OrderHistoryScreen({
  navigation,
}) {
  const { tableNumber } = useAuth();

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
        width < 430;

      const base =
        Math.min(shortest / 768, 1.05);

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

      return {
        isPhone,
        isVeryNarrow,

        safeTopExtra: 0,

        safeBottomExtra:
          Math.max(insets.bottom + 6, 12),

        topBarHeight:
          isPhone
            ? scale(60, 52, 64)
            : scale(76, 60, 78),

        topBarPadding:
          isVeryNarrow
            ? scale(12, 10, 14)
            : isPhone
              ? scale(14, 12, 16)
              : scale(24, 14, 26),

        topGap:
          scale(12, 6, 12),

        backText:
          isPhone
            ? scale(16, 14, 17)
            : scale(26, 16, 26),

        title:
          isVeryNarrow
            ? scale(20, 18, 22)
            : isPhone
              ? scale(23, 20, 24)
              : scale(30, 20, 30),

        tableText:
          isPhone
            ? scale(16, 14, 17)
            : scale(22, 15, 22),

        loadingText:
          scale(22, 16, 22),

        listPadding:
          isVeryNarrow
            ? scale(12, 10, 14)
            : isPhone
              ? scale(14, 12, 16)
              : scale(24, 16, 32),

        listBottom:
          isPhone
            ? Math.max(insets.bottom + 22, 30)
            : Math.max(insets.bottom + 32, 40),

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

        batchTitle:
          isPhone
            ? scale(22, 19, 23)
            : scale(28, 20, 28),

        orderNumber:
          scale(17, 12, 17),

        statusText:
          scale(15, 11, 15),

        statusPaddingV:
          scale(8, 5, 8),

        statusPaddingH:
          scale(14, 9, 14),

        createdText:
          scale(15, 11, 15),

        dividerMargin:
          scale(16, 10, 16),

        itemName:
          scale(18, 14, 18),

        itemDetails:
          scale(15, 11, 15),

        itemSubtotal:
          scale(17, 13, 17),

        noItemsText:
          scale(16, 12, 16),

        totalPadding:
          scale(16, 11, 16),

        totalRadius:
          scale(14, 10, 14),

        totalLabel:
          isPhone
            ? scale(17, 15, 18)
            : scale(20, 15, 20),

        totalValue:
          isPhone
            ? scale(21, 18, 22)
            : scale(24, 18, 24),

        emptyIcon:
          isPhone
            ? scale(70, 55, 74)
            : scale(90, 60, 90),

        emptyTitle:
          isPhone
            ? scale(23, 19, 24)
            : scale(30, 21, 30),

        emptyText:
          scale(19, 13, 19),

        emptyLine:
          scale(28, 20, 28),

        refreshMargin:
          scale(28, 18, 28),

        refreshPaddingV:
          scale(16, 11, 16),

        refreshPaddingH:
          scale(34, 22, 34),

        refreshRadius:
          scale(14, 10, 14),

        refreshText:
          scale(20, 15, 20),

        maxContentWidth:
          clamp(longest * 0.94, 340, 1100),
      };
    }, [
      width,
      height,
      insets.bottom,
    ]);

  const {
    tableResetRequired,
    acknowledgeTableReset,
  } = useTableStatus();

  const [orders, setOrders] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
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
    fetchOrderHistory();

    const refreshTimer =
      setInterval(() => {
        fetchOrderHistory(false);
      }, 5000);

    return () =>
      clearInterval(refreshTimer);
  }, []);

  const fetchOrderHistory = async (
    showLoading = true
  ) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

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
    if (!value) return '';
  
    const date = new Date(value);
  
    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }
  
    return date.toLocaleString(
      'en-PH',
      {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }
    );
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

  const renderOrderItem = (
    item,
    itemIndex
  ) => {
    const price =
      getItemPrice(item);

    const quantity =
      getItemQuantity(item);

    const subtotal =
      price * quantity;

    const itemKey =
      String(
        item.id ||
          item.menu_item_id ||
          itemIndex
      );

    return (
      <View
        key={itemKey}
        style={styles.itemRow}
      >
        <View style={styles.itemInfo}>
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
            {getItemName(item)}
          </Text>

          <Text
            style={[
              styles.itemDetails,
              {
                fontSize:
                  responsive.itemDetails,
              },
            ]}
          >
            Qty: {quantity} × ₱
            {formatMoney(price)}
          </Text>
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
      <View
        style={[
          styles.batchCard,
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
        <View style={styles.batchHeader}>
          <View style={styles.batchHeaderLeft}>
            <Text
              style={[
                styles.batchTitle,
                {
                  fontSize:
                    responsive.batchTitle,
                },
              ]}
              numberOfLines={1}
            >
              Batch {index + 1}
            </Text>

            <Text
              style={[
                styles.orderNumber,
                {
                  fontSize:
                    responsive.orderNumber,
                },
              ]}
              numberOfLines={2}
            >
              {order.order_number
                ? order.order_number
                : `Order ID: ${order.id}`}
            </Text>
          </View>

          <View
            style={[
              styles.statusPill,
              {
                paddingVertical:
                  responsive.statusPaddingV,
                paddingHorizontal:
                  responsive.statusPaddingH,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  fontSize:
                    responsive.statusText,
                },
              ]}
              numberOfLines={1}
            >
              {getOrderStatusLabel(
                order.status
              )}
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.createdText,
            {
              fontSize:
                responsive.createdText,
            },
          ]}
        >
          Created:{' '}
          {formatDateTime(
            order.created_at
          )}
        </Text>

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
            No items found for this order.
          </Text>
        ) : (
          <View style={styles.itemsList}>
            {items.map(renderOrderItem)}
          </View>
        )}

        <View
          style={[
            styles.totalRow,
            {
              padding:
                responsive.totalPadding,
              borderRadius:
                responsive.totalRadius,
            },
          ]}
        >
          <Text
            style={[
              styles.totalLabel,
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
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#efefef"
          translucent={false}
        />

        <SafeAreaView
          style={styles.safeArea}
          edges={['top']}
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
              Loading order history...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#b8b3b3"
        translucent={false}
      />

      <SafeAreaView
        style={styles.safeArea}
        edges={['top']}
      >
        <View style={styles.container}>
          <View
            style={[
              styles.topBar,
              {
                minHeight:
                  responsive.topBarHeight,
                paddingHorizontal:
                  responsive.topBarPadding,
                gap:
                  responsive.topGap,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.topBarSide}
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
                styles.title,
                {
                  fontSize:
                    responsive.title,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Order History
            </Text>

            <View style={styles.topBarSideRight}>
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
                Table {tableNumber || '-'}
              </Text>
            </View>
          </View>

          {orders.length === 0 ? (
            <View
              style={[
                styles.emptyContainer,
                {
                  paddingBottom:
                    responsive.safeBottomExtra +
                    30,
                },
              ]}
            >
              <Text
                style={[
                  styles.emptyIcon,
                  {
                    fontSize:
                      responsive.emptyIcon,
                    marginBottom:
                      responsive.listPadding / 1.5,
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
                No orders yet for this table session.
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
                Orders placed from this tablet will appear here after they are submitted.
              </Text>

              <TouchableOpacity
                style={[
                  styles.refreshButton,
                  {
                    marginTop:
                      responsive.refreshMargin,
                    paddingVertical:
                      responsive.refreshPaddingV,
                    paddingHorizontal:
                      responsive.refreshPaddingH,
                    borderRadius:
                      responsive.refreshRadius,
                  },
                ]}
                onPress={fetchOrderHistory}
              >
                <Text
                  style={[
                    styles.refreshButtonText,
                    {
                      fontSize:
                        responsive.refreshText,
                    },
                  ]}
                >
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
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.listContent,
                {
                  padding:
                    responsive.listPadding,
                  paddingBottom:
                    responsive.listBottom,
                  maxWidth:
                    responsive.maxContentWidth,
                },
              ]}
            />
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
      backgroundColor: '#fafafa',
    },

    safeArea: {
      flex: 1,
      backgroundColor: '#b8b3b3',
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
      fontWeight: '800',
      color: '#555',
      textAlign: 'center',
    },

    topBar: {
      backgroundColor: '#b8b3b3',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },

    topBarSide: {
      flex: 1,
      alignItems: 'flex-start',
    },

    topBarSideRight: {
      flex: 1,
      alignItems: 'flex-end',
    },

    backText: {
      color: '#fff',
      fontWeight: '800',
    },

    title: {
      flex: 1.2,
      color: '#fff',
      fontWeight: '900',
      textAlign: 'center',
    },

    tableText: {
      color: '#fff',
      fontWeight: '900',
      textAlign: 'right',
    },

    listContent: {
      width: '100%',
      alignSelf: 'center',
    },

    batchCard: {
      backgroundColor: '#fff',
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
      gap: 12,
    },

    batchHeaderLeft: {
      flex: 1,
      paddingRight: 8,
    },

    batchTitle: {
      fontWeight: '900',
      color: '#333',
    },

    orderNumber: {
      marginTop: 4,
      fontWeight: '800',
      color: '#777',
    },

    statusPill: {
      backgroundColor: '#fff3e8',
      borderColor: '#f68c45',
      borderWidth: 1.5,
      borderRadius: 999,
      maxWidth: 160,
    },

    statusText: {
      color: '#f68c45',
      fontWeight: '900',
      textAlign: 'center',
    },

    createdText: {
      marginTop: 12,
      fontWeight: '700',
      color: '#777',
    },

    divider: {
      height: 1,
      backgroundColor: '#eee',
    },

    itemsList: {
      width: '100%',
    },

    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f1f1',
      gap: 12,
    },

    itemInfo: {
      flex: 1,
      paddingRight: 8,
    },

    itemName: {
      fontWeight: '900',
      color: '#333',
    },

    itemDetails: {
      marginTop: 4,
      fontWeight: '700',
      color: '#777',
    },

    itemSubtotal: {
      fontWeight: '900',
      color: '#f68c45',
      textAlign: 'right',
      maxWidth: 150,
    },

    noItemsText: {
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
      gap: 12,
    },

    totalLabel: {
      fontWeight: '900',
      color: '#333',
    },

    totalValue: {
      fontWeight: '900',
      color: '#f68c45',
      textAlign: 'right',
      flexShrink: 1,
    },

    emptyContainer: {
      flex: 1,
      backgroundColor: '#efefef',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },

    emptyIcon: {},

    emptyTitle: {
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
    },

    emptyText: {
      marginTop: 12,
      fontWeight: '700',
      color: '#777',
      textAlign: 'center',
      maxWidth: 620,
    },

    refreshButton: {
      backgroundColor: '#f68c45',
      alignItems: 'center',
    },

    refreshButtonText: {
      color: '#fff',
      fontWeight: '900',
    },
  });