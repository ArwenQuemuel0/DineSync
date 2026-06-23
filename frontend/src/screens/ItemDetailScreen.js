import React, {
  useEffect,
  useMemo,
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
  TextInput,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

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
  isCustomItem,
} from '../utils/inventory';

export default function ItemDetailScreen({
  route,
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

      const longest =
        Math.max(width, height);

      const isPortrait =
        height >= width;

      const isPhone =
        width < 600;

      const isVeryNarrow =
        width < 430;

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
        max = size * 1.08
      ) => {
        return Math.round(
          clamp(size * base, min, max)
        );
      };

      const useSideCart =
        !isPortrait && width >= 720;

      const cartWidth =
        useSideCart
          ? clamp(width * 0.28, 275, 360)
          : '100%';

      const imageSize =
        isPhone
          ? scale(112, 86, 118)
          : scale(150, 105, 165);

      const recommendationWidth =
        isPhone
          ? clamp(width * 0.74, 235, 320)
          : clamp(width * 0.22, 220, 300);

      const cartMaxHeight =
        useSideCart
          ? undefined
          : isVeryNarrow
            ? clamp(height * 0.22, 145, 185)
            : clamp(height * 0.25, 175, 240);

      return {
        isPhone,
        isVeryNarrow,
        useSideCart,
        cartWidth,
        cartMaxHeight,

        topSafeExtra:
          isPhone
            ? 8
            : 6,

        bottomSafeExtra:
          Math.max(insets.bottom + 8, 14),

        topBarHeight:
          isPhone
            ? scale(58, 52, 62)
            : scale(70, 58, 74),

        topBarPaddingH:
          isPhone
            ? scale(14, 10, 16)
            : scale(24, 14, 26),

        topText:
          isPhone
            ? scale(18, 15, 20)
            : scale(28, 18, 28),

        tableText:
          isPhone
            ? scale(16, 13, 17)
            : scale(22, 15, 22),

        detailPadding:
          isPhone
            ? scale(14, 10, 16)
            : scale(28, 16, 30),

        detailBottomPadding:
          isPhone
            ? scale(18, 14, 22)
            : scale(24, 18, 30),

        cardPadding:
          isPhone
            ? scale(18, 14, 20)
            : scale(28, 18, 30),

        cardRadius:
          scale(24, 16, 26),

        imageSize,

        imageRadius:
          imageSize / 2,

        emoji:
          isPhone
            ? scale(50, 38, 54)
            : scale(68, 44, 70),

        itemName:
          isPhone
            ? scale(27, 22, 29)
            : scale(38, 26, 40),

        itemPrice:
          isPhone
            ? scale(23, 19, 25)
            : scale(30, 22, 32),

        category:
          scale(17, 13, 18),

        tagText:
          scale(12, 10, 13),

        stockText:
          isPhone
            ? scale(16, 13, 17)
            : scale(19, 15, 20),

        description:
          isPhone
            ? scale(15, 13, 16)
            : scale(18, 14, 18),

        descriptionLine:
          isPhone
            ? scale(22, 19, 23)
            : scale(26, 21, 27),

        label:
          scale(17, 13, 18),

        inputFont:
          scale(16, 13, 16),

        inputHeight:
          isPhone
            ? scale(92, 78, 96)
            : scale(105, 84, 110),

        buttonText:
          isPhone
            ? scale(18, 15, 19)
            : scale(22, 16, 22),

        buttonPaddingV:
          scale(14, 10, 14),

        buttonPaddingH:
          isPhone
            ? scale(28, 22, 32)
            : scale(44, 26, 44),

        recommendationTitle:
          isPhone
            ? scale(18, 16, 19)
            : scale(22, 17, 22),

        recommendationWidth,

        recommendationCircle:
          isPhone
            ? scale(56, 46, 58)
            : scale(64, 50, 66),

        recommendationName:
          scale(16, 12, 16),

        recommendationPrice:
          scale(15, 12, 15),

        sidebarPaddingH:
          scale(14, 10, 16),

        sidebarPaddingT:
          isPhone
            ? scale(9, 7, 10)
            : scale(16, 9, 16),

        cartIcon:
          scale(24, 18, 24),

        cartTitle:
          scale(22, 16, 22),

        cartItemName:
          scale(15, 12, 15),

        cartItemPrice:
          scale(14, 12, 14),

        cartRequest:
          scale(13, 11, 13),

        removeText:
          scale(24, 18, 24),

        qtyButton:
          scale(30, 25, 32),

        qtyButtonText:
          scale(18, 14, 18),

        qtyText:
          scale(16, 13, 16),

        totalLabel:
          scale(18, 14, 18),

        totalValue:
          scale(22, 17, 22),

        checkoutText:
          scale(16, 13, 16),

        checkoutPadding:
          scale(14, 10, 14),

        errorText:
          scale(26, 18, 26),

        backButtonText:
          scale(18, 14, 18),

        maxCardWidth:
          useSideCart
            ? clamp(longest * 0.7, 520, 950)
            : clamp(width - 28, 300, 680),
      };
    }, [
      width,
      height,
      insets.bottom,
    ]);

  const { item: routeItem } =
    route.params || {};

  const [liveItem, setLiveItem] =
    useState(routeItem);

  const [
    specialRequest,
    setSpecialRequest,
  ] = useState('');

  const {
    tableNumber,
    user,
  } = useAuth();

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

  const finalTableNumber =
    tableNumber ||
    user?.table_number;

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
      data?.image_url
        ? String(data.image_url).trim()
        : data?.image
          ? String(data.image).trim()
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

  const customItem =
    isCustomItem(item);

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

  const handleAddToCart = async () => {
    if (!item) return;

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

    if (!isAvailable) {
      Alert.alert(
        'Out of Stock',
        'This item is currently out of stock.'
      );

      return;
    }

    if (customItem) {
      const requestText =
        specialRequest.trim();

      if (!requestText) {
        Alert.alert(
          'Chef Oppa Special Request',
          'Please describe your Chef Oppa Special request before adding it to cart.'
        );

        return;
      }

      addToCart({
        ...item,
        quantity: 1,
        price: 0,
        notes: requestText,
        special_request: requestText,
        inventory_type: 'custom',
      });

      setSpecialRequest('');

      return;
    }

    addToCart(item);
  };

  const handleAddRecommendedItem = async (
    recommendedItem
  ) => {
    if (!recommendedItem) return;

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
    if (isCustomItem(cartItem)) {
      return;
    }

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

    if (!finalTableNumber) {
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
        tableNumber: finalTableNumber,
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

    const recommendedCustom =
      isCustomItem(recommendedItem);

    return (
      <View
        style={[
          styles.recommendationCard,
          {
            width:
              responsive.recommendationWidth,
            minHeight:
              responsive.recommendationCircle + 42,
          },
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
              {
                width:
                  responsive.recommendationCircle,
                height:
                  responsive.recommendationCircle,
                borderRadius:
                  responsive.recommendationCircle / 2,
              },
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
              {
                fontSize:
                  responsive.recommendationName,
              },
            ]}
            numberOfLines={2}
          >
            {recommendedItem.name}
          </Text>
        </TouchableOpacity>

        <View style={styles.recommendationRight}>
          <Text
            style={[
              styles.recommendationPrice,
              {
                fontSize:
                  responsive.recommendationPrice,
              },
            ]}
            numberOfLines={2}
          >
            {recommendedCustom
              ? 'To be confirmed'
              : `₱${formatMoney(recommendedItem.price)}`}
          </Text>

          <TouchableOpacity
            style={[
              styles.recommendationAddButton,
              !recommendedAvailable &&
                styles.recommendationAddButtonDisabled,
              !canOrder &&
                styles.recommendationAddButtonDisabled,
            ]}
            disabled={
              !recommendedAvailable ||
              !canOrder
            }
            onPress={() =>
              recommendedCustom
                ? handleOpenRecommendedItem(recommendedItem)
                : handleAddRecommendedItem(recommendedItem)
            }
          >
            <Text style={styles.recommendationAddText}>
              {recommendedCustom
                ? 'Request'
                : 'Add'}
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

    const customCartItem =
      isCustomItem(enrichedItem);

    const atMaxQuantity =
      customCartItem
        ? true
        : !canIncreaseQuantity(
            enrichedItem,
            cartItem.quantity,
            1
          );

    return (
      <View
        style={[
          styles.cartItem,
          !responsive.useSideCart &&
            styles.cartItemStacked,
        ]}
      >
        <View style={styles.cartItemTop}>
          <View style={styles.cartItemInfo}>
            <Text
              style={[
                styles.cartItemName,
                {
                  fontSize:
                    responsive.cartItemName,
                },
              ]}
              numberOfLines={2}
            >
              {cartItem.name}
            </Text>

            <Text
              style={[
                styles.cartItemPrice,
                {
                  fontSize:
                    responsive.cartItemPrice,
                },
              ]}
            >
              {customCartItem
                ? 'To be confirmed'
                : `₱${formatMoney(cartItem.price)}`}
            </Text>

            {customCartItem &&
            cartItem.special_request ? (
              <Text
                style={[
                  styles.cartRequestText,
                  {
                    fontSize:
                      responsive.cartRequest,
                  },
                ]}
              >
                Request: {cartItem.special_request}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={() =>
              handleRemoveItem(
                cartItem
              )
            }
          >
            <Text
              style={[
                styles.removeText,
                {
                  fontSize:
                    responsive.removeText,
                },
              ]}
            >
              ×
            </Text>
          </TouchableOpacity>
        </View>

        {customCartItem ? (
          <View style={styles.customQtyBox}>
            <Text style={styles.customQtyText}>
              Qty: 1
            </Text>
          </View>
        ) : (
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={[
                styles.qtyButton,
                {
                  width:
                    responsive.qtyButton,
                  height:
                    responsive.qtyButton,
                  borderRadius:
                    responsive.qtyButton / 3,
                },
              ]}
              onPress={() =>
                handleDecreaseQuantity(
                  cartItem
                )
              }
            >
              <Text
                style={[
                  styles.qtyButtonText,
                  {
                    fontSize:
                      responsive.qtyButtonText,
                  },
                ]}
              >
                -
              </Text>
            </TouchableOpacity>

            <Text
              style={[
                styles.qtyText,
                {
                  fontSize:
                    responsive.qtyText,
                },
              ]}
            >
              {cartItem.quantity}
            </Text>

            <TouchableOpacity
              style={[
                styles.qtyButton,
                {
                  width:
                    responsive.qtyButton,
                  height:
                    responsive.qtyButton,
                  borderRadius:
                    responsive.qtyButton / 3,
                },
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
                style={[
                  styles.qtyButtonText,
                  {
                    fontSize:
                      responsive.qtyButtonText,
                  },
                ]}
              >
                +
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (!item) {
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
          <View style={styles.emptyState}>
            <Text
              style={[
                styles.errorText,
                {
                  fontSize:
                    responsive.errorText,
                },
              ]}
            >
              Item not found.
            </Text>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                navigation.goBack()
              }
            >
              <Text
                style={[
                  styles.backButtonText,
                  {
                    fontSize:
                      responsive.backButtonText,
                  },
                ]}
              >
                Go Back
              </Text>
            </TouchableOpacity>
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
          'bottom',
        ]}
      >
        <View
          style={[
            styles.container,
            {
              paddingTop:
                responsive.topSafeExtra,
            },
          ]}
        >
          <View
            style={[
              styles.topBar,
              {
                minHeight:
                  responsive.topBarHeight,
                paddingHorizontal:
                  responsive.topBarPaddingH,
              },
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
                  {
                    fontSize:
                      responsive.topText,
                  },
                ]}
                numberOfLines={1}
              >
                {'<'} Go Back
              </Text>
            </TouchableOpacity>

            <View style={styles.topIcons}>
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
                Table {finalTableNumber || '-'}
              </Text>
            </View>
          </View>

          {!canOrder ? (
            <View style={styles.assignmentBanner}>
              <Text style={styles.assignmentBannerText}>
                {assignmentMessage}
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.contentArea,
              {
                flexDirection:
                  responsive.useSideCart
                    ? 'row'
                    : 'column',
              },
            ]}
          >
            <View
              style={[
                styles.detailSection,
                {
                  padding:
                    responsive.detailPadding,
                },
              ]}
            >
              <ScrollView
                style={styles.detailScroll}
                contentContainerStyle={[
                  styles.detailScrollContent,
                  {
                    paddingBottom:
                      responsive.detailBottomPadding,
                  },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View
                  style={[
                    styles.detailCard,
                    {
                      maxWidth:
                        responsive.maxCardWidth,
                      padding:
                        responsive.cardPadding,
                      borderRadius:
                        responsive.cardRadius,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.imageCircle,
                      {
                        width:
                          responsive.imageSize,
                        height:
                          responsive.imageSize,
                        borderRadius:
                          responsive.imageRadius,
                      },
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
                        style={[
                          styles.itemEmoji,
                          {
                            fontSize:
                              responsive.emoji,
                          },
                        ]}
                      >
                        🍲
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.itemName,
                      {
                        fontSize:
                          responsive.itemName,
                      },
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                  >
                    {item.name}
                  </Text>

                  <Text
                    style={[
                      styles.itemPrice,
                      {
                        fontSize:
                          responsive.itemPrice,
                      },
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                  >
                    {customItem
                      ? 'To be confirmed by staff'
                      : `₱${formatMoney(item.price)}`}
                  </Text>

                  <Text
                    style={[
                      styles.itemCategory,
                      {
                        fontSize:
                          responsive.category,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.category || 'Uncategorized'}
                  </Text>

                  {flavorTags.length > 0 ? (
                    <View style={styles.flavorTagContainer}>
                      {flavorTags.map((tag, index) => (
                        <View
                          key={`${tag}-${index}`}
                          style={styles.flavorTag}
                        >
                          <Text
                            style={[
                              styles.flavorTagText,
                              {
                                fontSize:
                                  responsive.tagText,
                              },
                            ]}
                          >
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
                      !canOrder
                        ? styles.notAvailableText
                        : !isAvailable
                          ? styles.notAvailableText
                          : isLowStock
                            ? styles.lowStockText
                            : styles.availableText,
                      {
                        fontSize:
                          responsive.stockText,
                      },
                    ]}
                  >
                    {!canOrder
                      ? 'Table not assigned'
                      : availabilityText}
                  </Text>

                  <Text
                    style={[
                      styles.description,
                      {
                        fontSize:
                          responsive.description,
                        lineHeight:
                          responsive.descriptionLine,
                      },
                    ]}
                  >
                    {customItem
                      ? 'Price and availability will be confirmed by staff.'
                      : itemDescription ||
                        'No description available for this item.'}
                  </Text>

                  {customItem ? (
                    <View style={styles.specialRequestBox}>
                      <Text
                        style={[
                          styles.specialRequestLabel,
                          {
                            fontSize:
                              responsive.label,
                          },
                        ]}
                      >
                        Tell us what you would like to order
                      </Text>

                      <TextInput
                        style={[
                          styles.specialRequestInput,
                          {
                            minHeight:
                              responsive.inputHeight,
                            fontSize:
                              responsive.inputFont,
                          },
                        ]}
                        value={specialRequest}
                        onChangeText={setSpecialRequest}
                        placeholder="Example: Samgyupsal fried rice with extra cheese, less spicy"
                        placeholderTextColor="#999"
                        multiline
                        textAlignVertical="top"
                      />
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.addToOrderButton,
                      {
                        paddingVertical:
                          responsive.buttonPaddingV,
                        paddingHorizontal:
                          responsive.buttonPaddingH,
                      },
                      (!isAvailable ||
                        !canOrder) &&
                        styles.addToOrderButtonDisabled,
                    ]}
                    disabled={
                      !isAvailable ||
                      !canOrder
                    }
                    onPress={handleAddToCart}
                  >
                    <Text
                      style={[
                        styles.addToOrderText,
                        {
                          fontSize:
                            responsive.buttonText,
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {!canOrder
                        ? 'Waiting for Staff'
                        : customItem
                          ? 'Add Request to Cart'
                          : 'Add to Order'}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.recommendationSection}>
                    <Text
                      style={[
                        styles.recommendationTitle,
                        {
                          fontSize:
                            responsive.recommendationTitle,
                        },
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
              </ScrollView>
            </View>

            <View
              style={[
                styles.cartSidebar,
                {
                  width:
                    responsive.useSideCart
                      ? responsive.cartWidth
                      : '100%',
                  maxHeight:
                    responsive.cartMaxHeight,
                  paddingHorizontal:
                    responsive.sidebarPaddingH,
                  paddingTop:
                    responsive.sidebarPaddingT,
                  paddingBottom:
                    responsive.bottomSafeExtra,
                  borderLeftWidth:
                    responsive.useSideCart
                      ? 1
                      : 0,
                  borderTopWidth:
                    responsive.useSideCart
                      ? 0
                      : 1,
                },
              ]}
            >
              <View style={styles.cartHeader}>
                <Text
                  style={[
                    styles.cartIcon,
                    {
                      fontSize:
                        responsive.cartIcon,
                    },
                  ]}
                >
                  🛒
                </Text>

                <Text
                  style={[
                    styles.cartTitle,
                    {
                      fontSize:
                        responsive.cartTitle,
                    },
                  ]}
                >
                  Your Order
                </Text>
              </View>

              {cartItems.length === 0 ? (
                <Text
                  style={[
                    styles.emptyCartText,
                    {
                      fontSize:
                        responsive.cartItemName,
                    },
                  ]}
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
                  horizontal={
                    !responsive.useSideCart
                  }
                  showsHorizontalScrollIndicator={
                    false
                  }
                  showsVerticalScrollIndicator={
                    false
                  }
                  contentContainerStyle={{
                    paddingBottom:
                      responsive.useSideCart
                        ? 20
                        : 8,
                    gap:
                      responsive.useSideCart
                        ? 0
                        : 12,
                  }}
                />
              )}

              <View style={styles.cartFooter}>
                <View style={styles.totalRow}>
                  <Text
                    style={[
                      styles.totalLabel,
                      {
                        fontSize:
                          responsive.totalLabel,
                      },
                    ]}
                  >
                    Total:
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
                    ₱{formatMoney(cartTotal)}
                  </Text>
                </View>

                {cartItems.some(isCustomItem) ? (
                  <Text style={styles.cartWarningText}>
                    Chef Oppa Special requests require staff confirmation for final price and availability.
                  </Text>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.checkoutButton,
                    {
                      paddingVertical:
                        responsive.checkoutPadding,
                    },
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
                    style={[
                      styles.checkoutButtonText,
                      {
                        fontSize:
                          responsive.checkoutText,
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    Confirm Order ({totalQuantity})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
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
      backgroundColor: '#b8b3b3',
    },

    safeArea: {
      flex: 1,
      backgroundColor: '#b8b3b3',
    },

    container: {
      flex: 1,
      backgroundColor: '#efefef',
    },

    topBar: {
      backgroundColor: '#b8b3b3',
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 12,
    },

    topBarText: {
      color: '#fff',
      fontWeight: '800',
    },

    topIcons: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    tableText: {
      color: '#fff',
      fontWeight: '900',
    },

    assignmentBanner: {
      backgroundColor: '#fff4e8',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginHorizontal: 12,
      marginTop: 10,
      marginBottom: 4,
    },

    assignmentBannerText: {
      color: '#8a4b12',
      fontWeight: '800',
      textAlign: 'center',
      lineHeight: 22,
    },

    contentArea: {
      flex: 1,
    },

    detailSection: {
      flex: 1,
    },

    detailScroll: {
      flex: 1,
      width: '100%',
    },

    detailScrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    detailCard: {
      width: '100%',
      backgroundColor: '#fff',
      borderWidth: 1.5,
      borderColor: '#f0b287',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },

    imageCircle: {
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

    itemEmoji: {},

    itemName: {
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
      width: '100%',
    },

    itemPrice: {
      color: '#f68c45',
      marginTop: 8,
      fontWeight: '800',
      textAlign: 'center',
      width: '100%',
    },

    itemCategory: {
      marginTop: 6,
      fontWeight: '800',
      color: '#777',
      textAlign: 'center',
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
      fontWeight: '800',
      marginTop: 8,
      textAlign: 'center',
    },

    notAvailableText: {
      color: 'red',
      fontWeight: '800',
      marginTop: 8,
      textAlign: 'center',
    },

    lowStockText: {
      color: '#e67e22',
      fontWeight: '800',
      marginTop: 8,
      textAlign: 'center',
    },

    description: {
      marginTop: 14,
      color: '#666',
      textAlign: 'center',
      width: '100%',
    },

    specialRequestBox: {
      width: '100%',
      marginTop: 18,
    },

    specialRequestLabel: {
      fontWeight: '900',
      color: '#333',
      marginBottom: 8,
      textAlign: 'left',
    },

    specialRequestInput: {
      width: '100%',
      backgroundColor: '#fafafa',
      borderWidth: 1.5,
      borderColor: '#f0b287',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: '#333',
      fontWeight: '600',
      lineHeight: 22,
    },

    addToOrderButton: {
      marginTop: 20,
      backgroundColor: '#f68c45',
      borderRadius: 18,
    },

    addToOrderButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    addToOrderText: {
      color: '#fff',
      fontWeight: '900',
      textAlign: 'center',
    },

    recommendationSection: {
      width: '100%',
      marginTop: 22,
    },

    recommendationTitle: {
      fontWeight: '900',
      color: '#333',
      marginBottom: 12,
      textAlign: 'center',
    },

    recommendationCard: {
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
      fontWeight: '900',
      color: '#333',
    },

    recommendationRight: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    recommendationPrice: {
      fontWeight: '900',
      color: '#f68c45',
      marginBottom: 8,
      textAlign: 'center',
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
      borderLeftColor: '#ddd',
      borderTopColor: '#ddd',
    },

    cartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },

    cartIcon: {
      marginRight: 8,
    },

    cartTitle: {
      fontWeight: '800',
      color: '#222',
    },

    emptyCartText: {
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
      maxWidth: 230,
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
      fontWeight: '800',
      color: '#222',
    },

    cartItemPrice: {
      fontWeight: '700',
      color: '#f68c45',
      marginTop: 4,
    },

    cartRequestText: {
      marginTop: 5,
      color: '#666',
      fontWeight: '700',
      lineHeight: 18,
    },

    customQtyBox: {
      marginTop: 10,
      alignSelf: 'flex-start',
      backgroundColor: '#fff4eb',
      borderWidth: 1,
      borderColor: '#f0b287',
      borderRadius: 10,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },

    customQtyText: {
      fontSize: 13,
      color: '#f68c45',
      fontWeight: '900',
    },

    cartWarningText: {
      backgroundColor: '#fff4eb',
      color: '#7a3f09',
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
      marginBottom: 10,
    },

    removeText: {
      fontWeight: '800',
      color: '#999',
    },

    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
    },

    qtyButton: {
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
    },

    qtyText: {
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
      gap: 10,
    },

    totalLabel: {
      fontWeight: '800',
      color: '#333',
    },

    totalValue: {
      fontWeight: '900',
      color: '#f68c45',
      flexShrink: 1,
      textAlign: 'right',
    },

    checkoutButton: {
      backgroundColor: '#f68c45',
      borderRadius: 10,
      alignItems: 'center',
    },

    checkoutButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    checkoutButtonText: {
      color: '#fff',
      fontWeight: '800',
    },

    emptyState: {
      flex: 1,
      backgroundColor: '#efefef',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },

    errorText: {
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
      fontWeight: '800',
    },
  });