import React, {
  useEffect,
  useMemo,
} from 'react';

import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
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

import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTableStatus } from '../context/TableStatusContext';

import {
  getItemId,
  canIncreaseQuantity,
  isOutOfStock,
} from '../utils/inventory';

export default function CartScreen({
  navigation,
}) {
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

      const isPhone =
        width < 600;

      const isVeryNarrow =
        width < 430;

      const isLandscape =
        width > height;

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
        max = size * 1.05
      ) => {
        return Math.round(
          clamp(size * base, min, max)
        );
      };

      const visualSize =
        isVeryNarrow
          ? scale(92, 70, 96)
          : isPhone
            ? scale(105, 82, 110)
            : scale(130, 90, 130);

      const qtySize =
        isVeryNarrow
          ? scale(42, 36, 44)
          : isPhone
            ? scale(48, 40, 50)
            : scale(62, 42, 62);

      return {
        isPhone,
        isVeryNarrow,
        isLandscape,

        screenPaddingH:
          isVeryNarrow
            ? scale(14, 12, 16)
            : isPhone
              ? scale(18, 14, 22)
              : scale(32, 20, 32),

        screenPaddingTop:
          isPhone
            ? scale(12, 10, 16)
            : scale(18, 14, 24),

        screenPaddingBottom:
          Math.max(
            insets.bottom + 10,
            isPhone ? 18 : 22
          ),

        logoSize:
          isPhone
            ? scale(58, 46, 62)
            : scale(80, 56, 80),

        headerFont:
          isVeryNarrow
            ? scale(34, 28, 36)
            : isPhone
              ? scale(40, 30, 42)
              : scale(56, 38, 56),

        backFont:
          isPhone
            ? scale(18, 15, 20)
            : scale(28, 18, 28),

        clearFont:
          isPhone
            ? scale(15, 13, 16)
            : scale(20, 14, 20),

        titleMarginTop:
          isPhone
            ? scale(14, 10, 16)
            : scale(18, 14, 22),

        titleMarginBottom:
          isPhone
            ? scale(14, 12, 16)
            : scale(18, 14, 22),

        cardPadding:
          isVeryNarrow
            ? scale(14, 12, 16)
            : isPhone
              ? scale(16, 13, 18)
              : scale(24, 16, 24),

        cardRadius:
          scale(20, 14, 22),

        cardGap:
          isPhone
            ? scale(18, 15, 22)
            : scale(18, 14, 20),

        visualSize,

        visualRadius:
          visualSize / 2,

        visualText:
          isPhone
            ? scale(44, 34, 46)
            : scale(62, 40, 62),

        itemName:
          isVeryNarrow
            ? scale(21, 18, 22)
            : isPhone
              ? scale(25, 20, 26)
              : scale(38, 24, 38),

        itemDesc:
          isPhone
            ? scale(14, 12, 15)
            : scale(20, 14, 20),

        itemPrice:
          isPhone
            ? scale(23, 19, 25)
            : scale(36, 22, 36),

        infoGap:
          isPhone
            ? scale(14, 10, 16)
            : scale(24, 14, 24),

        qtySize,

        qtyRadius:
          qtySize / 2,

        qtyText:
          isPhone
            ? scale(24, 20, 26)
            : scale(34, 24, 34),

        quantityText:
          isPhone
            ? scale(23, 19, 25)
            : scale(34, 22, 34),

        quantityMargin:
          isPhone
            ? scale(12, 9, 14)
            : scale(22, 12, 22),

        footerPaddingV:
          isPhone
            ? scale(15, 12, 17)
            : scale(24, 16, 24),

        footerPaddingH:
          isPhone
            ? scale(16, 13, 18)
            : scale(32, 18, 32),

        footerRadius:
          scale(18, 14, 20),

        totalText:
          isPhone
            ? scale(24, 20, 26)
            : scale(42, 26, 42),

        checkoutFont:
          isPhone
            ? scale(16, 14, 17)
            : scale(24, 16, 24),

        checkoutPaddingV:
          isPhone
            ? scale(13, 11, 14)
            : scale(18, 12, 18),

        checkoutPaddingH:
          isPhone
            ? scale(22, 18, 24)
            : scale(36, 22, 36),

        emptyText:
          isPhone
            ? scale(21, 18, 22)
            : scale(30, 20, 30),

        emptyMargin:
          isPhone
            ? scale(80, 55, 90)
            : scale(120, 70, 120),
      };
    }, [
      width,
      height,
      insets.bottom,
    ]);

  const {
    cartItems,
    updateQuantity,
    incrementQuantity,
    cartTotal,
    clearCart,
    getEnrichedItem,
    refreshCartInventory,
  } = useCart();

  const {
    tableNumber,
    user,
  } = useAuth();

  const {
    canOrder,
    ensureCanOrder,
    assignmentMessage,
    tableResetRequired,
    acknowledgeTableReset,
  } = useTableStatus();

  const finalTableNumber =
    tableNumber ||
    user?.table_number;

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

  const formatMoney = (value) => {
    const n = Number(value);

    return Number.isFinite(n)
      ? n.toFixed(2)
      : '0.00';
  };

  const handleIncreaseQuantity = (item) => {
    incrementQuantity(
      getItemId(item)
    );
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert(
        'Empty Order',
        'Please add at least one item before proceeding.'
      );

      return;
    }

    if (!finalTableNumber) {
      Alert.alert(
        'Table Error',
        'No table number found. Please login again using the assigned table account.'
      );

      return;
    }

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

    navigation.navigate(
      'OrderConfirm',
      {
        cartItems,
        total: cartTotal,
        tableNumber: finalTableNumber,
      }
    );
  };

  const renderItem = ({
    item,
  }) => {
    const enrichedItem =
      getEnrichedItem(item);

    const atMaxQuantity =
      !canIncreaseQuantity(
        enrichedItem,
        item.quantity,
        1
      );

    const disabledIncrease =
      atMaxQuantity ||
      isOutOfStock(enrichedItem);

    return (
      <View
        style={[
          styles.cartItem,
          responsive.isPhone &&
            styles.cartItemPhone,
          {
            padding:
              responsive.cardPadding,
            borderRadius:
              responsive.cardRadius,
            marginBottom:
              responsive.cardGap,
          },
        ]}
      >
        <View
          style={[
            styles.itemVisual,
            {
              width:
                responsive.visualSize,
              height:
                responsive.visualSize,
              borderRadius:
                responsive.visualRadius,
            },
          ]}
        >
          <Text
            style={[
              styles.itemVisualText,
              {
                fontSize:
                  responsive.visualText,
              },
            ]}
          >
            🍜
          </Text>
        </View>

        <View
          style={[
            styles.itemInfo,
            responsive.isPhone &&
              styles.itemInfoPhone,
            {
              marginLeft:
                responsive.isPhone
                  ? 0
                  : responsive.infoGap,
            },
          ]}
        >
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
            {item.name}
          </Text>

          <Text
            style={[
              styles.itemDesc,
              {
                fontSize:
                  responsive.itemDesc,
              },
            ]}
            numberOfLines={2}
          >
            Korean dish prepared fresh and served hot.
          </Text>

          <Text
            style={[
              styles.itemPrice,
              {
                fontSize:
                  responsive.itemPrice,
              },
            ]}
            numberOfLines={1}
          >
            ₱{formatMoney(item.price)}
          </Text>
        </View>

        <View
          style={[
            styles.quantityContainer,
            responsive.isPhone &&
              styles.quantityContainerPhone,
          ]}
        >
          <TouchableOpacity
            onPress={() =>
              updateQuantity(
                item.id,
                item.quantity - 1
              )
            }
            style={[
              styles.qtyBtn,
              {
                width:
                  responsive.qtySize,
                height:
                  responsive.qtySize,
                borderRadius:
                  responsive.qtyRadius,
              },
            ]}
          >
            <Text
              style={[
                styles.qtyText,
                {
                  fontSize:
                    responsive.qtyText,
                },
              ]}
            >
              -
            </Text>
          </TouchableOpacity>

          <Text
            style={[
              styles.quantity,
              {
                fontSize:
                  responsive.quantityText,
                marginHorizontal:
                  responsive.quantityMargin,
              },
            ]}
          >
            {item.quantity}
          </Text>

          <TouchableOpacity
            onPress={() =>
              handleIncreaseQuantity(item)
            }
            disabled={disabledIncrease}
            style={[
              styles.qtyBtn,
              {
                width:
                  responsive.qtySize,
                height:
                  responsive.qtySize,
                borderRadius:
                  responsive.qtyRadius,
              },
              disabledIncrease &&
                styles.qtyBtnDisabled,
            ]}
          >
            <Text
              style={[
                styles.qtyText,
                {
                  fontSize:
                    responsive.qtyText,
                },
              ]}
            >
              +
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
              paddingHorizontal:
                responsive.screenPaddingH,
              paddingTop:
                responsive.screenPaddingTop,
              paddingBottom:
                responsive.screenPaddingBottom,
            },
          ]}
        >
          <View style={styles.headerRow}>
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
                      responsive.backFont,
                  },
                ]}
                numberOfLines={1}
              >
                {'<'} Go Back
              </Text>
            </TouchableOpacity>

            <Image
              source={require('../../assets/chefoppa_logo.png')}
              style={[
                styles.logo,
                {
                  width:
                    responsive.logoSize,
                  height:
                    responsive.logoSize,
                },
              ]}
              resizeMode="contain"
            />
          </View>

          <View
            style={[
              styles.titleRow,
              {
                marginTop:
                  responsive.titleMarginTop,
                marginBottom:
                  responsive.titleMarginBottom,
              },
            ]}
          >
            <Text
              style={[
                styles.header,
                {
                  fontSize:
                    responsive.headerFont,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              My Cart
            </Text>

            <TouchableOpacity
              onPress={clearCart}
              disabled={cartItems.length === 0}
              style={[
                cartItems.length === 0 &&
                  styles.disabledAction,
              ]}
            >
              <Text
                style={[
                  styles.clearText,
                  {
                    fontSize:
                      responsive.clearFont,
                  },
                ]}
                numberOfLines={1}
              >
                Clear Order
              </Text>
            </TouchableOpacity>
          </View>

          {!canOrder ? (
            <View style={styles.assignmentBanner}>
              <Text style={styles.assignmentBannerText}>
                {assignmentMessage}
              </Text>
            </View>
          ) : null}

          <FlatList
            data={cartItems}
            renderItem={renderItem}
            keyExtractor={(item, index) =>
              String(
                getItemId(item) ||
                  item?.id ||
                  index
              )
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom:
                responsive.footerPaddingV + 26,
              flexGrow: 1,
            }}
            ListEmptyComponent={
              <Text
                style={[
                  styles.emptyText,
                  {
                    fontSize:
                      responsive.emptyText,
                    marginTop:
                      responsive.emptyMargin,
                  },
                ]}
              >
                Your cart is empty
              </Text>
            }
          />

          <View
            style={[
              styles.footer,
              responsive.isPhone &&
                styles.footerPhone,
              {
                paddingVertical:
                  responsive.footerPaddingV,
                paddingHorizontal:
                  responsive.footerPaddingH,
                borderRadius:
                  responsive.footerRadius,
              },
            ]}
          >
            <Text
              style={[
                styles.totalText,
                {
                  fontSize:
                    responsive.totalText,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Total: ₱{formatMoney(cartTotal)}
            </Text>

            <TouchableOpacity
              style={[
                styles.checkoutBtn,
                {
                  paddingVertical:
                    responsive.checkoutPaddingV,
                  paddingHorizontal:
                    responsive.checkoutPaddingH,
                },
                (cartItems.length === 0 ||
                  !canOrder) &&
                  styles.qtyBtnDisabled,
              ]}
              onPress={handleCheckout}
              disabled={
                cartItems.length === 0 ||
                !canOrder
              }
            >
              <Text
                style={[
                  styles.checkoutBtnText,
                  {
                    fontSize:
                      responsive.checkoutFont,
                  },
                ]}
                numberOfLines={1}
              >
                Order Now
              </Text>
            </TouchableOpacity>
          </View>
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

    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },

    backText: {
      color: '#3b3b3b',
      fontWeight: '800',
    },

    logo: {},

    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
    },

    header: {
      flexShrink: 1,
      fontWeight: '900',
      color: '#3d3d3d',
    },

    clearText: {
      color: '#999',
      fontWeight: '800',
    },

    disabledAction: {
      opacity: 0.45,
    },

    assignmentBanner: {
      backgroundColor: '#fff4e8',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 16,
    },

    assignmentBannerText: {
      color: '#8a4b12',
      fontWeight: '800',
      textAlign: 'center',
      lineHeight: 22,
    },

    cartItem: {
      flexDirection: 'row',
      borderWidth: 1.5,
      borderColor: '#f0b287',
      backgroundColor: '#fff',
      alignItems: 'center',
      gap: 12,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },

    cartItemPhone: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    itemVisual: {
      backgroundColor: '#eee',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },

    itemVisualText: {},

    itemInfo: {
      flex: 1,
      minWidth: 160,
    },

    itemInfoPhone: {
      minWidth: 0,
      flex: 1,
    },

    itemName: {
      fontWeight: '900',
      color: '#f68c45',
    },

    itemDesc: {
      color: '#888',
      marginTop: 6,
      lineHeight: 21,
      fontWeight: '600',
    },

    itemPrice: {
      color: '#2f2f2f',
      marginTop: 10,
      fontWeight: '800',
    },

    quantityContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },

    quantityContainerPhone: {
      width: '100%',
      marginTop: 12,
    },

    qtyBtn: {
      backgroundColor: '#f68c45',
      justifyContent: 'center',
      alignItems: 'center',
    },

    qtyBtnDisabled: {
      opacity: 0.45,
    },

    qtyText: {
      fontWeight: '900',
      color: '#fff',
    },

    quantity: {
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
    },

    footer: {
      marginTop: 16,
      alignSelf: 'center',
      width: '100%',
      maxWidth: 920,
      borderWidth: 1,
      borderColor: '#d0d0d0',
      backgroundColor: '#fafafa',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 14,
    },

    footerPhone: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },

    totalText: {
      flex: 1,
      minWidth: 190,
      fontWeight: '900',
      color: '#333',
    },

    checkoutBtn: {
      backgroundColor: '#f68c45',
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },

    checkoutBtnText: {
      color: '#fff',
      fontWeight: '900',
    },

    emptyText: {
      alignSelf: 'center',
      color: '#999',
      fontWeight: '800',
      textAlign: 'center',
    },
  });