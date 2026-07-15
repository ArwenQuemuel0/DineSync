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
  Platform,
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

const APP_TIME_ZONE =
  process.env.EXPO_PUBLIC_APP_TIMEZONE ||
  'Asia/Manila';

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

      const isLandscape =
        width > height;

      const isPhone =
        shortest < 600;

      const isVeryNarrow =
        width < 390;

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

      const useCompactHeader =
        isVeryNarrow ||
        isShortLandscape ||
        usableWidth < 420;

      return {
        isPhone,
        isVeryNarrow,
        isLandscape,
        isShortLandscape,
        useCompactHeader,

        safeTopExtra: 0,

        safeBottomExtra:
          Math.max(
            insets.bottom +
            (Platform.OS === 'android' ? 12 : 8),
            18
          ),

        topBarHeight:
          useCompactHeader
            ? scale(54, 48, 58)
            : isPhone
              ? scale(60, 52, 66)
              : scale(76, 60, 80),

        topBarPadding:
          isVeryNarrow
            ? scale(10, 8, 12)
            : isPhone
              ? scale(14, 12, 16)
              : scale(24, 16, 28),

        topGap:
          useCompactHeader
            ? scale(7, 5, 8)
            : scale(12, 8, 12),

        backText:
          useCompactHeader
            ? scale(13, 11, 14)
            : isPhone
              ? scale(16, 14, 17)
              : scale(24, 17, 26),

        title:
          useCompactHeader
            ? scale(18, 16, 20)
            : isPhone
              ? scale(23, 20, 24)
              : scale(30, 22, 30),

        tableText:
          useCompactHeader
            ? scale(13, 11, 14)
            : isPhone
              ? scale(16, 14, 17)
              : scale(22, 16, 22),

        loadingText:
          isPhone
            ? scale(18, 15, 20)
            : scale(22, 16, 22),

        listPadding:
          isVeryNarrow
            ? scale(12, 10, 14)
            : isPhone
              ? scale(14, 12, 16)
              : scale(24, 16, 32),

        listBottom:
          isPhone
            ? Math.max(insets.bottom + 26, 36)
            : Math.max(insets.bottom + 36, 46),

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
            ? scale(21, 18, 23)
            : scale(28, 20, 28),

        orderNumber:
          isPhone
            ? scale(14, 12, 15)
            : scale(17, 12, 17),

        statusText:
          isPhone
            ? scale(13, 11, 14)
            : scale(15, 11, 15),

        statusPaddingV:
          isPhone
            ? scale(7, 5, 8)
            : scale(8, 5, 8),

        statusPaddingH:
          isPhone
            ? scale(11, 9, 13)
            : scale(14, 9, 14),

        createdText:
          isPhone
            ? scale(13, 11, 14)
            : scale(15, 11, 15),

        dividerMargin:
          isPhone
            ? scale(12, 10, 14)
            : scale(16, 10, 16),

        itemName:
          isPhone
            ? scale(15, 13, 17)
            : scale(18, 14, 18),

        itemDetails:
          isPhone
            ? scale(13, 11, 14)
            : scale(15, 11, 15),

        itemSubtotal:
          isPhone
            ? scale(15, 13, 16)
            : scale(17, 13, 17),

        noItemsText:
          isPhone
            ? scale(14, 12, 15)
            : scale(16, 12, 16),

        totalPadding:
          isPhone
            ? scale(13, 11, 15)
            : scale(16, 11, 16),

        totalRadius:
          scale(14, 10, 14),

        totalLabel:
          isPhone
            ? scale(16, 14, 18)
            : scale(20, 15, 20),

        totalValue:
          isPhone
            ? scale(20, 17, 22)
            : scale(24, 18, 24),

        emptyIcon:
          isPhone
            ? scale(70, 55, 76)
            : scale(90, 60, 92),

        emptyTitle:
          isPhone
            ? scale(22, 18, 24)
            : scale(30, 21, 30),

        emptyText:
          isPhone
            ? scale(15, 13, 17)
            : scale(19, 13, 19),

        emptyLine:
          isPhone
            ? scale(22, 19, 24)
            : scale(28, 20, 28),

        refreshMargin:
          scale(28, 18, 28),

        refreshPaddingV:
          isPhone
            ? scale(13, 11, 15)
            : scale(16, 11, 16),

        refreshPaddingH:
          isPhone
            ? scale(26, 22, 32)
            : scale(34, 22, 34),

        refreshRadius:
          scale(14, 10, 14),

        refreshText:
          isPhone
            ? scale(17, 15, 19)
            : scale(20, 15, 20),

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


  const getOrderRefills = (order) => {
    return Array.isArray(order?.refills)
      ? order.refills
      : [];
  };

  const getRefillStatusLabel = (status) => {
    const value = String(status || "requested");
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const renderOrderItem = (
    item,
    itemIndex
  ) => {
    const price =
      getItemPrice(item);

    const unlimited =
      Boolean(
        item?.is_unlimited ??
        item?.menu_item?.is_unlimited ??
        false
      );

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

          {unlimited ? (
            <Text style={styles.unlimitedBadge}>
              Unlimited
            </Text>
          ) : null}

          {unlimited ? (
            <Text style={styles.unlimitedNotice}>
              Unlimited refills are available. Please ask the service staff for assistance.
            </Text>
          ) : null}

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
              adjustsFontSizeToFit
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


        {getOrderRefills(order).length > 0 ? (
          <View style={styles.refillSection}>
            <Text style={styles.refillTitle}>
              Refill Requests
            </Text>

            {getOrderRefills(order).map((refill) => (
              <View
                key={String(refill.id)}
                style={styles.refillCard}
              >
                <View style={styles.refillHeader}>
                  <Text style={styles.refillStatus}>
                    {getRefillStatusLabel(refill.status)}
                  </Text>
                  <Text style={styles.refillDate}>
                    {formatDateTime(refill.requested_at)}
                  </Text>
                </View>

                {(refill.items || []).map((item) => (
                  <Text
                    key={String(item.id)}
                    style={styles.refillItem}
                  >
                    • {item.ingredient_name} ({item.quantity} {item.unit})
                  </Text>
                ))}

                {refill.notes ? (
                  <Text style={styles.refillNotes}>
                    Notes: {refill.notes}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

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
            numberOfLines={1}
            adjustsFontSizeToFit
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
        edges={[
          'top',
          'left',
          'right',
        ]}
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
                adjustsFontSizeToFit
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
              minimumFontScale={0.75}
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
                adjustsFontSizeToFit
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
                    responsive.listBottom +
                    responsive.safeBottomExtra,
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
      flexShrink: 0,
    },

    topBarSide: {
      flex: 0.9,
      alignItems: 'flex-start',
      minWidth: 0,
    },

    topBarSideRight: {
      flex: 0.9,
      alignItems: 'flex-end',
      minWidth: 0,
    },

    backText: {
      color: '#fff',
      fontWeight: '800',
    },

    title: {
      flex: 1.25,
      color: '#fff',
      fontWeight: '900',
      textAlign: 'center',
      minWidth: 0,
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
      minWidth: 0,
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
      maxWidth: 165,
      minWidth: 78,
      flexShrink: 1,
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
      minWidth: 0,
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
      flexShrink: 1,
    },

    unlimitedBadge: {
      marginTop: 4,
      alignSelf: 'flex-start',
      backgroundColor: '#2E7D32',
      color: '#fff',
      fontWeight: '900',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: 'hidden',
    },

    unlimitedNotice: {
      marginTop: 4,
      color: '#2E7D32',
      fontWeight: '800',
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
      flexShrink: 0,
    },


    refillSection: {
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: '#eee',
      paddingTop: 12,
    },

    refillTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: '#333',
      marginBottom: 10,
    },

    refillCard: {
      backgroundColor: '#fff8f2',
      borderWidth: 1,
      borderColor: '#f0d4be',
      borderRadius: 10,
      padding: 10,
      marginBottom: 8,
    },

    refillHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },

    refillStatus: {
      color: '#f68c45',
      fontWeight: '900',
    },

    refillDate: {
      color: '#777',
      fontSize: 12,
    },

    refillItem: {
      color: '#444',
      marginBottom: 2,
    },

    refillNotes: {
      marginTop: 6,
      color: '#666',
      fontStyle: 'italic',
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