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
  useWindowDimensions,
} from 'react-native';

import {
  useFocusEffect,
  CommonActions,
} from '@react-navigation/native';

import {
  getMenu,
  getDishRecommendations,
} from '../api/dinesync';

import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTableStatus } from '../context/TableStatusContext';

import {
  getItemId,
  isItemOrderable,
  isOutOfStock,
  canIncreaseQuantity,
  getAvailabilityDisplayText,
  shouldShowLowStockWarning,
} from '../utils/inventory';

export default function ItemDetailScreen({
  route,
  navigation,
}) {
  const {
    width,
    height,
  } = useWindowDimensions();

  const isLandscape =
    width > height;

  const isSmallScreen =
    width < 760;

  const useSideCart =
    width >= 760;

  const cartWidth =
    isLandscape ? 330 : 285;

  const { item: routeItem } =
    route.params || {};

  const [liveItem, setLiveItem] =
    useState(routeItem);

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
    incrementQuantity,
    removeFromCart,
    cartTotal,
    getEnrichedItem,
    syncMenuInventory,
    mergeInventoryItems,
    refreshCartInventory,
  } = useCart();

  const {
    canOrder,
    ensureCanOrder,
    assignmentMessage,
    tableResetRequired,
    acknowledgeTableReset,
  } = useTableStatus();

  const item =
    liveItem || routeItem;

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

  const refreshLiveItem =
    async () => {
      if (!routeItem?.id) {
        return;
      }

      try {
        const response =
          await getMenu();

        if (
          !response?.success ||
          !Array.isArray(
            response.data
          )
        ) {
          return;
        }

        syncMenuInventory(
          response.data
        );

        const freshItem =
          response.data.find(
            (menuItem) =>
              String(
                menuItem.id
              ) ===
              String(routeItem.id)
          );

        if (freshItem) {
          setLiveItem(freshItem);
        }
      } catch (error) {
        console.log(
          'ITEM INVENTORY REFRESH ERROR:',
          error?.message
        );
      }
    };

  useFocusEffect(
    React.useCallback(() => {
      refreshLiveItem();
    }, [routeItem?.id])
  );

  useEffect(() => {
    if (item?.name) {
      fetchRecommendations();
    }
  }, [
    item?.id,
    item?.name,
  ]);

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
        const recommendedItems =
          response.data || [];

        setRecommendations(
          recommendedItems
        );

        mergeInventoryItems(
          recommendedItems
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
    const n =
      Number(value);

    return Number.isFinite(n)
      ? n.toFixed(2)
      : '0.00';
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

  const imageUri =
    getItemImage(item);

  const isAvailable =
    isItemOrderable(item);

  const isLowStock =
    shouldShowLowStockWarning(item);

  const availabilityText =
    getAvailabilityDisplayText(item);

  const itemDescription =
    getItemDescription(item);

  const flavorTags =
    getFlavorTags(item);

  const mealType =
    getMealType(item);

  const handleAddToCart = () => {
    if (!item) return;

    if (!isAvailable) {
      Alert.alert(
        'Out of Stock',
        'This item is currently out of stock.'
      );

      return;
    }

    addToCart(item);
  };

  const handleAddRecommendedItem = (
    recommendedItem
  ) => {
    if (!recommendedItem) return;

    if (!isItemOrderable(recommendedItem)) {
      Alert.alert(
        'Out of Stock',
        'This recommended item is currently out of stock.'
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
    incrementQuantity(
      getItemId(cartItem)
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

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert(
        'Empty Order',
        'Please add at least one item before proceeding.'
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

    if (!tableNumber) {
      Alert.alert(
        'Table Error',
        'No table number found. Please login again using the assigned table account.'
      );

      return;
    }

    navigation.navigate(
      'OrderConfirm',
      {
        cartItems,
        total: cartTotal,
        tableNumber,
      }
    );
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
      isItemOrderable(recommendedItem);

    return (
      <View
        style={[
          styles.recommendationCard,
          isSmallScreen &&
            styles.recommendationCardSmall,
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
          <View
            style={[
              styles.recommendationCircle,
              isSmallScreen &&
                styles.recommendationCircleSmall,
            ]}
          >
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
            style={[
              styles.recommendationName,
              isSmallScreen &&
                styles.recommendationNameSmall,
            ]}
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
    const enrichedItem =
      getEnrichedItem(cartItem);

    const atMaxQuantity =
      !canIncreaseQuantity(
        enrichedItem,
        cartItem.quantity,
        1
      );

    return (
      <View
        style={[
          styles.cartItem,
          !useSideCart &&
            styles.cartItemStacked,
        ]}
      >
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
            style={[
              styles.qtyButton,
              (atMaxQuantity ||
                isOutOfStock(enrichedItem)) &&
                styles.qtyButtonDisabled,
            ]}
            disabled={
              atMaxQuantity ||
              isOutOfStock(enrichedItem)
            }
            onPress={() => {
              if (
                !atMaxQuantity &&
                !isOutOfStock(
                  enrichedItem
                )
              ) {
                handleIncreaseQuantity(
                  cartItem
                );
              }
            }}
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
        <View
          style={[
            styles.topBar,
            isSmallScreen &&
              styles.topBarSmall,
          ]}
        >
          <TouchableOpacity
            onPress={() =>
              navigation.goBack()
            }
          >
            <Text
              style={[
                styles.topBarText,
                isSmallScreen &&
                  styles.topBarTextSmall,
              ]}
            >
              {'<'} Go Back
            </Text>
          </TouchableOpacity>

          <View style={styles.topIcons}>
            <Text
              style={[
                styles.tableText,
                isSmallScreen &&
                  styles.tableTextSmall,
              ]}
            >
              Table {tableNumber || '-'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.contentArea,
            !useSideCart &&
              styles.contentAreaStacked,
          ]}
        >
          <View
            style={[
              styles.detailSection,
              !useSideCart &&
                styles.detailSectionStacked,
            ]}
          >
            <View
              style={[
                styles.detailCard,
                !useSideCart &&
                  styles.detailCardStacked,
              ]}
            >
              <View
                style={[
                  styles.imageCircle,
                  isSmallScreen &&
                    styles.imageCircleSmall,
                ]}
              >
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

              <Text
                style={[
                  styles.itemName,
                  isSmallScreen &&
                    styles.itemNameSmall,
                ]}
              >
                {item.name}
              </Text>

              <Text
                style={[
                  styles.itemPrice,
                  isSmallScreen &&
                    styles.itemPriceSmall,
                ]}
              >
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

              {mealType ? (
                <Text style={styles.mealTypeText}>
                  {mealType}
                </Text>
              ) : null}

              <Text
                style={[
                  !isAvailable
                    ? styles.notAvailableText
                    : isLowStock
                      ? styles.lowStockText
                      : styles.availableText,
                  isSmallScreen &&
                    styles.stockTextSmall,
                ]}
              >
                {availabilityText}
              </Text>

              <Text
                style={[
                  styles.description,
                  isSmallScreen &&
                    styles.descriptionSmall,
                ]}
              >
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
                  style={[
                    styles.addToOrderText,
                    isSmallScreen &&
                      styles.addToOrderTextSmall,
                  ]}
                >
                  Add to Order
                </Text>
              </TouchableOpacity>

              <View style={styles.recommendationSection}>
                <Text
                  style={[
                    styles.recommendationTitle,
                    isSmallScreen &&
                      styles.recommendationTitleSmall,
                  ]}
                >
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

          <View
            style={[
              styles.cartSidebar,
              {
                width: useSideCart
                  ? cartWidth
                  : '100%',
              },
              !useSideCart &&
                styles.cartSidebarStacked,
            ]}
          >
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
                horizontal={!useSideCart}
                showsHorizontalScrollIndicator={
                  false
                }
                showsVerticalScrollIndicator={
                  false
                }
                contentContainerStyle={{
                  paddingBottom:
                    useSideCart
                      ? 20
                      : 8,
                  gap:
                    useSideCart
                      ? 0
                      : 12,
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
                  (cartItems.length === 0 ||
                    !canOrder) &&
                    styles.checkoutButtonDisabled,
                ]}
                disabled={
                  cartItems.length === 0 ||
                  !canOrder
                }
                onPress={handleCheckout}
              >
                <Text
                  style={
                    styles.checkoutButtonText
                  }
                >
                  Confirm Order ({totalQuantity})
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
      minHeight: 70,
      backgroundColor: '#b8b3b3',
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 8,
    },

    topBarSmall: {
      minHeight: 58,
      paddingHorizontal: 16,
    },

    topBarText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 28,
    },

    topBarTextSmall: {
      fontSize: 22,
    },

    topIcons: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    tableText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 22,
    },

    tableTextSmall: {
      fontSize: 17,
    },

    contentArea: {
      flex: 1,
      flexDirection: 'row',
    },

    contentAreaStacked: {
      flexDirection: 'column',
    },

    detailSection: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 28,
    },

    detailSectionStacked: {
      padding: 14,
      justifyContent: 'flex-start',
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

    detailCardStacked: {
      width: '100%',
      minHeight: 0,
      padding: 18,
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

    imageCircleSmall: {
      width: 110,
      height: 110,
      borderRadius: 55,
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

    itemNameSmall: {
      fontSize: 27,
    },

    itemPrice: {
      color: '#f68c45',
      marginTop: 8,
      fontSize: 30,
      fontWeight: '800',
    },

    itemPriceSmall: {
      fontSize: 24,
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

    mealTypeText: {
      marginTop: 8,
      color: '#777',
      fontSize: 14,
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

    lowStockText: {
      color: '#e67e22',
      fontSize: 19,
      fontWeight: '800',
      marginTop: 8,
    },

    stockTextSmall: {
      fontSize: 16,
    },

    description: {
      marginTop: 14,
      fontSize: 18,
      color: '#666',
      textAlign: 'center',
      lineHeight: 26,
    },

    descriptionSmall: {
      fontSize: 15,
      lineHeight: 22,
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

    addToOrderTextSmall: {
      fontSize: 18,
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

    recommendationTitleSmall: {
      fontSize: 18,
    },

    recommendationCard: {
      width: 285,
      minHeight: 105,
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

    recommendationCardSmall: {
      width: 245,
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

    recommendationCircleSmall: {
      width: 54,
      height: 54,
      borderRadius: 27,
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

    recommendationNameSmall: {
      fontSize: 14,
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
      backgroundColor: '#fff',
      borderLeftWidth: 1,
      borderLeftColor: '#ddd',
      paddingHorizontal: 14,
      paddingTop: 16,
    },

    cartSidebarStacked: {
      width: '100%',
      maxHeight: 235,
      borderLeftWidth: 0,
      borderTopWidth: 1,
      borderTopColor: '#ddd',
      paddingTop: 10,
    },

    cartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
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

    cartItemStacked: {
      minWidth: 170,
      maxWidth: 220,
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

    qtyButtonDisabled: {
      backgroundColor: '#c9c9c9',
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
      paddingTop: 12,
      paddingBottom: 12,
    },

    totalRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 12,
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