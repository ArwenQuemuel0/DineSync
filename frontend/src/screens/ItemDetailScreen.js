import React, {
  useEffect,
  useState,
} from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';

import api from '../api/dinesync';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function ItemDetailScreen({
  route,
  navigation,
}) {
  const { item } = route.params || {};

  const { tableNumber } = useAuth();

  const [
    pairings,
    setPairings,
  ] = useState([]);

  const [
    loadingPairings,
    setLoadingPairings,
  ] = useState(false);

  const {
    addToCart,
    cartItems,
    updateQuantity,
    removeFromCart,
    cartTotal,
  } = useCart();

  useEffect(() => {
    if (item?.name) {
      fetchPairings();
    }
  }, [item?.name]);

  const fetchPairings = async () => {
    try {
      setLoadingPairings(true);

      const response =
        await api.post(
          '/ai/pairing',
          {
            itemName: item.name,
          }
        );

      if (response.data.success) {
        setPairings(
          response.data.recommendations || []
        );
      }
    } catch (error) {
      console.log(
        'PAIRING ERROR:',
        error.response?.data ||
          error.message
      );
    } finally {
      setLoadingPairings(false);
    }
  };

  const formatMoney = (value) => {
    const n = Number(value);

    return Number.isFinite(n)
      ? n.toFixed(2)
      : '0.00';
  };

  const getItemId = (data) => {
    return (
      data?.id ||
      data?.menu_item_id
    );
  };

  const getStock = (data) => {
    return (
      Number(data?.available_quantity) ||
      Number(data?.stock) ||
      Number(data?.inventory) ||
      Number(data?.available_stock) ||
      Number(data?.current_stock) ||
      0
    );
  };

  const getItemImage = (data) => {
    const image =
      data?.image ||
      data?.image_url ||
      '';

    return String(image).trim();
  };

  const stock = getStock(item);

  const imageUri = getItemImage(item);

  const isAvailable =
    (
      item?.is_available === true ||
      item?.is_available === 1 ||
      item?.is_available === 'true'
    ) &&
    stock > 0;

  const handleAddToCart = () => {
    if (!item) return;

    const itemId = getItemId(item);

    const existingItem =
      cartItems.find(
        (cartItem) =>
          getItemId(cartItem) === itemId
      );

    const currentQty =
      existingItem
        ? existingItem.quantity
        : 0;

    if (!isAvailable) {
      Alert.alert(
        'Not Available',
        'This item is currently not available.'
      );

      return;
    }

    if (currentQty >= stock) {
      Alert.alert(
        'Insufficient Stock',
        'You cannot add more of this item because it has limited availability.'
      );

      return;
    }

    addToCart(item);
  };

  const handleIncreaseQuantity = (
    cartItem
  ) => {
    const cartStock =
      getStock(cartItem);

    const cartItemId =
      getItemId(cartItem);

    if (
      cartItem.quantity >= cartStock
    ) {
      Alert.alert(
        'Insufficient Stock',
        'You cannot add more of this item because it has limited availability.'
      );

      return;
    }

    updateQuantity(
      cartItemId,
      cartItem.quantity + 1
    );
  };

  const handleDecreaseQuantity = (
    cartItem
  ) => {
    const cartItemId =
      getItemId(cartItem);

    updateQuantity(
      cartItemId,
      cartItem.quantity - 1
    );
  };

  const handleRemoveItem = (
    cartItem
  ) => {
    const cartItemId =
      getItemId(cartItem);

    removeFromCart(cartItemId);
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert(
        'Empty Order',
        'Please add at least one item before proceeding.'
      );

      return;
    }

    if (!tableNumber) {
      Alert.alert(
        'Table Error',
        'No table number found. Please login again using the assigned table account.'
      );

      return;
    }

    navigation.navigate('Payment', {
      cartItems,
      total: cartTotal,
      tableNumber,
    });
  };

  const totalQuantity =
    cartItems.reduce(
      (total, cartItem) =>
        total +
        Number(cartItem.quantity || 0),
      0
    );

  const renderPairing = ({
    item: pairing,
  }) => {
    return (
      <View style={styles.pairingCard}>
        <View style={styles.pairingCircle}>
          <Text style={styles.pairingEmoji}>
            🍽️
          </Text>
        </View>

        <Text
          style={styles.pairingText}
          numberOfLines={2}
        >
          {pairing}
        </Text>
      </View>
    );
  };

  const renderCartItem = ({
    item: cartItem,
  }) => {
    return (
      <View style={styles.cartItem}>
        <View style={styles.cartItemTop}>
          <View
            style={styles.cartItemInfo}
          >
            <Text
              style={styles.cartItemName}
              numberOfLines={2}
            >
              {cartItem.name}
            </Text>

            <Text
              style={styles.cartItemPrice}
            >
              ₱
              {formatMoney(
                cartItem.price
              )}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() =>
              handleRemoveItem(
                cartItem
              )
            }
          >
            <Text style={styles.removeText}>
              ×
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.qtyRow}>
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() =>
              handleDecreaseQuantity(
                cartItem
              )
            }
          >
            <Text
              style={styles.qtyButtonText}
            >
              -
            </Text>
          </TouchableOpacity>

          <Text style={styles.qtyText}>
            {cartItem.quantity}
          </Text>

          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() =>
              handleIncreaseQuantity(
                cartItem
              )
            }
          >
            <Text
              style={styles.qtyButtonText}
            >
              +
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!item) {
    return (
      <View style={styles.frame}>
        <View style={styles.container}>
          <Text style={styles.errorText}>
            Item not found.
          </Text>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              navigation.goBack()
            }
          >
            <Text
              style={styles.backButtonText}
            >
              Go Back
            </Text>
          </TouchableOpacity>
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
            <Text style={styles.topBarText}>
              {'<'} Go Back
            </Text>
          </TouchableOpacity>

          <View style={styles.topIcons}>
            <Text style={styles.tableText}>
              Table {tableNumber || '-'}
            </Text>

            <Text style={styles.iconSpacing}>
              ◷
            </Text>

            <Text style={styles.iconSpacing}>
              🔔
            </Text>
          </View>
        </View>

        <View style={styles.contentArea}>
          <View style={styles.detailSection}>
            <View style={styles.detailCard}>
              <View style={styles.imageCircle}>
                {imageUri ? (
                  <Image
                    source={{
                      uri: imageUri,
                    }}
                    style={styles.itemImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    style={styles.itemEmoji}
                  >
                    🍲
                  </Text>
                )}
              </View>

              <Text style={styles.itemName}>
                {item.name}
              </Text>

              <Text style={styles.itemPrice}>
                ₱{formatMoney(item.price)}
              </Text>

              <Text
                style={
                  isAvailable
                    ? styles.availableText
                    : styles.notAvailableText
                }
              >
                {isAvailable
                  ? `Available (${stock})`
                  : 'Sold Out'}
              </Text>

              <Text style={styles.description}>
                {item.description ||
                  'A selected menu item from Chef Oppa.'}
              </Text>

              <TouchableOpacity
                style={[
                  styles.addToOrderButton,
                  !isAvailable &&
                    styles.addToOrderButtonDisabled,
                ]}
                disabled={!isAvailable}
                onPress={handleAddToCart}
              >
                <Text
                  style={
                    styles.addToOrderText
                  }
                >
                  Add to Order
                </Text>
              </TouchableOpacity>

              <View style={styles.pairingSection}>
                <Text style={styles.pairingTitle}>
                  Recommended Pairings
                </Text>

                {loadingPairings ? (
                  <ActivityIndicator
                    size="small"
                    color="#f68c45"
                  />
                ) : pairings.length > 0 ? (
                  <FlatList
                    horizontal
                    data={pairings}
                    keyExtractor={(
                      pairing,
                      index
                    ) =>
                      `${pairing}-${index}`
                    }
                    renderItem={
                      renderPairing
                    }
                    showsHorizontalScrollIndicator={
                      false
                    }
                  />
                ) : (
                  <Text style={styles.noPairingText}>
                    No recommendations yet.
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.cartSidebar}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartIcon}>
                🛒
              </Text>

              <Text style={styles.cartTitle}>
                Your Order
              </Text>
            </View>

            {cartItems.length === 0 ? (
              <Text
                style={styles.emptyCartText}
              >
                No items added yet.
              </Text>
            ) : (
              <FlatList
                data={cartItems}
                keyExtractor={(cartItem) =>
                  String(
                    getItemId(cartItem)
                  )
                }
                renderItem={renderCartItem}
                showsVerticalScrollIndicator={
                  false
                }
                contentContainerStyle={{
                  paddingBottom: 20,
                }}
              />
            )}

            <View style={styles.cartFooter}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Total:
                </Text>

                <Text style={styles.totalValue}>
                  ₱{formatMoney(cartTotal)}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.checkoutButton,
                  cartItems.length === 0 &&
                    styles.checkoutButtonDisabled,
                ]}
                disabled={
                  cartItems.length === 0
                }
                onPress={handleCheckout}
              >
                <Text
                  style={
                    styles.checkoutButtonText
                  }
                >
                  Checkout ({totalQuantity})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
    },

    topBar: {
      height: 70,
      backgroundColor: '#b8b3b3',
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
    },

    topBarText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 28,
    },

    topIcons: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    tableText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 22,
      marginRight: 24,
    },

    iconSpacing: {
      color: '#f2f2f2',
      fontSize: 28,
      marginRight: 20,
    },

    contentArea: {
      flex: 1,
      flexDirection: 'row',
    },

    detailSection: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 28,
    },

    detailCard: {
      width: '86%',
      minHeight: 610,
      backgroundColor: '#fff',
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: '#f0b287',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },

    imageCircle: {
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: '#ececec',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      marginBottom: 18,
    },

    itemImage: {
      width: '100%',
      height: '100%',
    },

    itemEmoji: {
      fontSize: 68,
    },

    itemName: {
      fontSize: 42,
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
    },

    itemPrice: {
      color: '#f68c45',
      marginTop: 10,
      fontSize: 32,
      fontWeight: '800',
    },

    availableText: {
      color: '#4CAF50',
      fontSize: 20,
      fontWeight: '800',
      marginTop: 8,
    },

    notAvailableText: {
      color: 'red',
      fontSize: 20,
      fontWeight: '800',
      marginTop: 8,
    },

    description: {
      marginTop: 18,
      fontSize: 20,
      color: '#666',
      textAlign: 'center',
      lineHeight: 30,
    },

    addToOrderButton: {
      marginTop: 26,
      backgroundColor: '#f68c45',
      paddingVertical: 16,
      paddingHorizontal: 48,
      borderRadius: 18,
    },

    addToOrderButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    addToOrderText: {
      color: '#fff',
      fontSize: 24,
      fontWeight: '900',
    },

    pairingSection: {
      width: '100%',
      marginTop: 26,
    },

    pairingTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: '#333',
      marginBottom: 12,
      textAlign: 'center',
    },

    pairingCard: {
      width: 150,
      backgroundColor: '#fff7ef',
      borderWidth: 1,
      borderColor: '#f0b287',
      borderRadius: 18,
      padding: 12,
      marginHorizontal: 8,
      alignItems: 'center',
    },

    pairingCircle: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: '#ffe1ca',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },

    pairingEmoji: {
      fontSize: 26,
    },

    pairingText: {
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'center',
      color: '#333',
    },

    noPairingText: {
      textAlign: 'center',
      color: '#999',
      fontSize: 16,
    },

    cartSidebar: {
      width: 310,
      backgroundColor: '#fff',
      borderLeftWidth: 1,
      borderLeftColor: '#ddd',
      paddingHorizontal: 14,
      paddingTop: 16,
    },

    cartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },

    cartIcon: {
      fontSize: 24,
      marginRight: 8,
    },

    cartTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: '#222',
    },

    emptyCartText: {
      fontSize: 16,
      color: '#777',
      marginTop: 10,
    },

    cartItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#eeeeee',
    },

    cartItemTop: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'flex-start',
    },

    cartItemInfo: {
      flex: 1,
      paddingRight: 8,
    },

    cartItemName: {
      fontSize: 15,
      fontWeight: '800',
      color: '#222',
    },

    cartItemPrice: {
      fontSize: 14,
      fontWeight: '700',
      color: '#f68c45',
      marginTop: 4,
    },

    removeText: {
      fontSize: 24,
      fontWeight: '800',
      color: '#999',
    },

    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
    },

    qtyButton: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: '#f68c45',
      justifyContent: 'center',
      alignItems: 'center',
    },

    qtyButtonText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 18,
    },

    qtyText: {
      fontSize: 16,
      fontWeight: '800',
      marginHorizontal: 12,
    },

    cartFooter: {
      borderTopWidth: 1,
      borderTopColor: '#dddddd',
      paddingTop: 14,
      paddingBottom: 14,
    },

    totalRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },

    totalLabel: {
      fontSize: 18,
      fontWeight: '800',
      color: '#333',
    },

    totalValue: {
      fontSize: 22,
      fontWeight: '900',
      color: '#f68c45',
    },

    checkoutButton: {
      backgroundColor: '#f68c45',
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },

    checkoutButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    checkoutButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
    },

    errorText: {
      fontSize: 26,
      fontWeight: '800',
      color: '#333',
      textAlign: 'center',
    },

    backButton: {
      marginTop: 24,
      backgroundColor: '#f68c45',
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 12,
    },

    backButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '800',
    },
  });