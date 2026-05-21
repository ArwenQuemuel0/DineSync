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

import {
  getDishRecommendations,
} from '../api/dinesync';

import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function ItemDetailScreen({
  route,
  navigation,
}) {
  const { item } = route.params || {};

  const { tableNumber } = useAuth();

  const [
    recommendations,
    setRecommendations,
  ] = useState([]);

  const [
    loadingRecommendations,
    setLoadingRecommendations,
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
      fetchRecommendations();
    }
  }, [item?.id, item?.name]);

  const fetchRecommendations = async () => {
    try {
      setLoadingRecommendations(true);

      const response =
        await getDishRecommendations({
          selectedItem: item,
          cartItems,
        });

      console.log(
        'AI RECOMMENDATIONS RESPONSE:',
        response
      );

      if (response.success) {
        setRecommendations(
          response.data || []
        );
      } else {
        setRecommendations([]);
      }
    } catch (error) {
      console.log(
        'AI RECOMMENDATIONS ERROR:',
        error?.response?.data ||
          error.message
      );

      setRecommendations([]);
    } finally {
      setLoadingRecommendations(false);
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
    const stockValue =
      data?.available_quantity ??
      data?.stock ??
      data?.inventory ??
      data?.available_stock ??
      data?.current_stock;

    if (
      stockValue === undefined ||
      stockValue === null ||
      stockValue === ''
    ) {
      return null;
    }

    const numericStock =
      Number(stockValue);

    if (!Number.isFinite(numericStock)) {
      return null;
    }

    return numericStock;
  };

  const isItemAvailable = (data) => {
    const stock = getStock(data);

    const availability =
      data?.is_available;

    const markedAvailable =
      availability === true ||
      availability === 1 ||
      availability === 'true' ||
      availability === '1';

    const markedUnavailable =
      availability === false ||
      availability === 0 ||
      availability === 'false' ||
      availability === '0';

    if (markedUnavailable) {
      return false;
    }

    if (stock === null) {
      return markedAvailable;
    }

    return markedAvailable && stock > 0;
  };

  const getItemImage = (data) => {
    const image =
      data?.image
        ? String(data.image).trim()
        : data?.image_url
          ? String(data.image_url).trim()
          : '';

    return image;
  };

  const getItemDescription = (data) => {
    const description =
      data?.description ||
      data?.item_description ||
      data?.details ||
      data?.desc ||
      '';

    return String(description).trim();
  };

  const getFlavorTags = (data) => {
    if (Array.isArray(data?.flavor_tags)) {
      return data.flavor_tags
        .map((tag) =>
          String(tag).trim()
        )
        .filter(Boolean);
    }

    if (!data?.flavor_tags) {
      return [];
    }

    return String(data.flavor_tags)
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  };

  const getMealType = (data) => {
    return data?.meal_type
      ? String(data.meal_type).trim()
      : null;
  };

  const stock = getStock(item);

  const imageUri = getItemImage(item);

  const isAvailable =
    isItemAvailable(item);

  const itemDescription =
    getItemDescription(item);

  const flavorTags =
    getFlavorTags(item);

  const mealType =
    getMealType(item);

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

    if (
      stock !== null &&
      currentQty >= stock
    ) {
      Alert.alert(
        'Insufficient Stock',
        'You cannot add more of this item because it has limited availability.'
      );

      return;
    }

    addToCart(item);
  };

  const handleAddRecommendedItem = (
    recommendedItem
  ) => {
    if (!recommendedItem) return;

    if (!isItemAvailable(recommendedItem)) {
      Alert.alert(
        'Not Available',
        'This recommended item is currently not available.'
      );

      return;
    }

    addToCart(recommendedItem);
  };

  const handleOpenRecommendedItem = (
    recommendedItem
  ) => {
    navigation.replace(
      'ItemDetail',
      {
        item: recommendedItem,
      }
    );
  };

  const handleIncreaseQuantity = (
    cartItem
  ) => {
    const cartStock =
      getStock(cartItem);

    const cartItemId =
      getItemId(cartItem);

    if (
      cartStock !== null &&
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

  const renderRecommendation = ({
    item: recommendedItem,
  }) => {
    const recommendedImage =
      getItemImage(recommendedItem);

    const recommendedAvailable =
      isItemAvailable(recommendedItem);

    return (
      <View
        style={[
          styles.recommendationCard,
          !recommendedAvailable &&
            styles.recommendationCardDisabled,
        ]}
      >
        <TouchableOpacity
          style={styles.recommendationLeft}
          disabled={!recommendedAvailable}
          onPress={() =>
            handleOpenRecommendedItem(
              recommendedItem
            )
          }
        >
          <View style={styles.recommendationCircle}>
            {recommendedImage ? (
              <Image
                source={{
                  uri: recommendedImage,
                }}
                style={styles.recommendationImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.recommendationEmoji}>
                🍽️
              </Text>
            )}
          </View>

          <Text
            style={styles.recommendationName}
            numberOfLines={2}
          >
            {recommendedItem.name}
          </Text>
        </TouchableOpacity>

        <View style={styles.recommendationRight}>
          <Text style={styles.recommendationPrice}>
            ₱{formatMoney(recommendedItem.price)}
          </Text>

          <TouchableOpacity
            style={[
              styles.recommendationAddButton,
              !recommendedAvailable &&
                styles.recommendationAddButtonDisabled,
            ]}
            disabled={!recommendedAvailable}
            onPress={() =>
              handleAddRecommendedItem(
                recommendedItem
              )
            }
          >
            <Text style={styles.recommendationAddText}>
              Add
            </Text>
          </TouchableOpacity>
        </View>
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

              <Text style={styles.itemCategory}>
                {item.category || 'Uncategorized'}
              </Text>

              {flavorTags.length > 0 ? (
                <View style={styles.flavorTagContainer}>
                  {flavorTags.map((tag, index) => (
                    <View
                      key={`${tag}-${index}`}
                      style={styles.flavorTag}
                    >
                      <Text style={styles.flavorTagText}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text
                style={
                  isAvailable
                    ? styles.availableText
                    : styles.notAvailableText
                }
              >
                {isAvailable
                  ? stock !== null
                    ? `Available (${stock})`
                    : 'Available'
                  : 'Sold Out'}
              </Text>

              <Text style={styles.description}>
                {itemDescription ||
                  'No description available for this item.'}
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

              <View style={styles.recommendationSection}>
                <Text style={styles.recommendationTitle}>
                  Must try pairings!
                </Text>

                {loadingRecommendations ? (
                  <ActivityIndicator
                    size="small"
                    color="#f68c45"
                  />
                ) : recommendations.length > 0 ? (
                  <FlatList
                    horizontal
                    data={recommendations}
                    keyExtractor={(
                      recommendedItem,
                      index
                    ) =>
                      String(
                        recommendedItem.id ||
                          index
                      )
                    }
                    renderItem={
                      renderRecommendation
                    }
                    showsHorizontalScrollIndicator={
                      false
                    }
                    contentContainerStyle={{
                      paddingHorizontal: 4,
                    }}
                  />
                ) : (
                  <Text style={styles.noRecommendationText}>
                    No recommendations available yet.
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
      minHeight: 650,
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
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: '#ececec',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      marginBottom: 14,
    },

    itemImage: {
      width: '100%',
      height: '100%',
    },

    itemEmoji: {
      fontSize: 68,
    },

    itemName: {
      fontSize: 38,
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
    },

    itemPrice: {
      color: '#f68c45',
      marginTop: 8,
      fontSize: 30,
      fontWeight: '800',
    },

    itemCategory: {
      marginTop: 6,
      fontSize: 17,
      fontWeight: '800',
      color: '#777',
    },

    flavorTagContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginTop: 8,
      gap: 6,
    },

    flavorTag: {
      backgroundColor: '#fff4eb',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },

    flavorTagText: {
      color: '#f68c45',
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'capitalize',
    },

    availableText: {
      color: '#4CAF50',
      fontSize: 19,
      fontWeight: '800',
      marginTop: 8,
    },

    notAvailableText: {
      color: 'red',
      fontSize: 19,
      fontWeight: '800',
      marginTop: 8,
    },

    description: {
      marginTop: 14,
      fontSize: 18,
      color: '#666',
      textAlign: 'center',
      lineHeight: 26,
    },

    addToOrderButton: {
      marginTop: 20,
      backgroundColor: '#f68c45',
      paddingVertical: 14,
      paddingHorizontal: 44,
      borderRadius: 18,
    },

    addToOrderButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    addToOrderText: {
      color: '#fff',
      fontSize: 22,
      fontWeight: '900',
    },

    recommendationSection: {
      width: '100%',
      marginTop: 22,
    },

    recommendationTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: '#333',
      marginBottom: 12,
      textAlign: 'center',
    },

    recommendationCard: {
      width: 285,
      height: 105,
      backgroundColor: '#fff7ef',
      borderWidth: 1,
      borderColor: '#f0b287',
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    recommendationCardDisabled: {
      opacity: 0.45,
    },

    recommendationLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      paddingRight: 10,
    },

    recommendationCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#ffe1ca',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      marginRight: 12,
    },

    recommendationImage: {
      width: '100%',
      height: '100%',
    },

    recommendationEmoji: {
      fontSize: 28,
    },

    recommendationName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '900',
      color: '#333',
    },

    recommendationRight: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    recommendationPrice: {
      fontSize: 17,
      fontWeight: '900',
      color: '#f68c45',
      marginBottom: 8,
    },

    recommendationAddButton: {
      backgroundColor: '#f68c45',
      paddingVertical: 7,
      paddingHorizontal: 24,
      borderRadius: 10,
    },

    recommendationAddButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    recommendationAddText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 14,
    },

    noRecommendationText: {
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