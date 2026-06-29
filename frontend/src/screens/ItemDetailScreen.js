import React, {
  useCallback,
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
  isCustomItem,
} from '../utils/inventory';

const EXPECTED_MENU_DEBUG_SOURCE =
  'WEB_MENU_INGREDIENT_AVAILABILITY_FIXED_2026';

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase();
};

const normalizeInventoryType = (value) => {
  return normalizeText(value)
    .replace(/[-\s]+/g, '_');
};

const isBackendAvailableTrue = (value) => {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    normalizeText(value) === 'true' ||
    normalizeText(value) === 'yes' ||
    normalizeText(value) === 'available'
  );
};

const isIngredientCustomItem = (item) => {
  const category =
    normalizeText(item?.category);

  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  const name =
    normalizeText(item?.name);

  return (
    isCustomItem(item) ||
    category === 'chef oppa special' ||
    inventoryType === 'custom' ||
    name.includes(
      'custom chef oppa special'
    )
  );
};

const getMaxOrderQuantity = (item) => {
  if (!item) {
    return 0;
  }

  if (isIngredientCustomItem(item)) {
    return 1;
  }

  const maxQty =
    Number(
      item?.max_order_quantity ??
      item?.remaining_today ??
      0
    );

  return Number.isFinite(maxQty)
    ? Math.max(0, maxQty)
    : 0;
};

const getAllowedOrderQuantity = (item) => {
  return getMaxOrderQuantity(item);
};

const isBackendAvailableItem = (item) => {
  if (!item) {
    return false;
  }

  if (isIngredientCustomItem(item)) {
    return isBackendAvailableTrue(
      item?.is_available
    );
  }

  const maxQty =
    getMaxOrderQuantity(item);

  return (
    isBackendAvailableTrue(
      item?.is_available
    ) &&
    maxQty > 0
  );
};

const getBackendStockMessage = (item) => {
  if (!item) {
    return 'Unavailable';
  }

  if (isIngredientCustomItem(item)) {
    return isBackendAvailableItem(item)
      ? 'Custom request available'
      : (
          item?.unavailable_reason ||
          item?.stock_label ||
          item?.daily_inventory_label ||
          'Unavailable'
        );
  }

  if (isBackendAvailableItem(item)) {
    return (
      item?.stock_label ||
      item?.daily_inventory_label ||
      ''
    );
  }

  return (
    item?.unavailable_reason ||
    item?.stock_label ||
    item?.daily_inventory_label ||
    'Unavailable'
  );
};

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

      const isPhone =
        shortest < 600;

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
        width > height &&
        width >= 760 &&
        height >= 520;

      const cartWidth =
        useSideCart
          ? clamp(width * 0.27, 250, 370)
          : '100%';

      const detailWidth =
        useSideCart
          ? width - cartWidth
          : width;

      const imageSize =
        isPhone
          ? scale(132, 100, 142)
          : scale(182, 130, 198);

      const recommendationWidth =
        isPhone
          ? clamp(width * 0.84, 290, 370)
          : useSideCart
            ? clamp(detailWidth * 0.43, 390, 460)
            : clamp(width * 0.42, 360, 460);

      const recommendationRightWidth =
        isPhone
          ? scale(86, 76, 94)
          : scale(102, 92, 112);

      const recommendationMinHeight =
        isPhone
          ? scale(112, 100, 120)
          : scale(124, 112, 132);

      const cartPhoneMinHeight =
        clamp(height * 0.22, 210, 255);

      const cartPhoneListMaxHeight =
        clamp(height * 0.13, 92, 120);

      return {
        isPhone,
        useSideCart,
        cartWidth,

        topSafeExtra: 0,

        bottomSafeExtra:
          Math.max(insets.bottom + 2, 6),

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
          useSideCart
            ? scale(18, 12, 20)
            : scale(12, 8, 14),

        detailBottomPadding:
          useSideCart
            ? scale(8, 6, 10)
            : scale(6, 4, 8),

        cardPadding:
          useSideCart
            ? scale(28, 18, 30)
            : scale(16, 12, 18),

        cardRadius:
          scale(24, 16, 26),

        imageSize,

        imageRadius:
          imageSize / 2,

        emoji:
          isPhone
            ? scale(58, 42, 62)
            : scale(78, 52, 82),

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

        limitText:
          isPhone
            ? scale(14, 12, 15)
            : scale(16, 13, 17),

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
        recommendationRightWidth,
        recommendationMinHeight,

        recommendationCircle:
          isPhone
            ? scale(70, 56, 74)
            : scale(82, 66, 88),

        recommendationName:
          isPhone
            ? scale(16, 13, 17)
            : scale(17, 14, 18),

        recommendationLine:
          isPhone
            ? scale(20, 16, 21)
            : scale(21, 17, 22),

        recommendationPrice:
          isPhone
            ? scale(15, 12, 15)
            : scale(16, 13, 16),

        recommendationAddText:
          isPhone
            ? scale(14, 12, 14)
            : scale(15, 13, 15),

        recommendationAddPaddingH:
          isPhone
            ? scale(18, 14, 20)
            : scale(22, 18, 24),

        sidebarPaddingH:
          scale(14, 10, 16),

        sidebarPaddingT:
          useSideCart
            ? scale(16, 9, 16)
            : scale(6, 4, 8),

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
          scale(12, 8, 12),

        errorText:
          scale(26, 18, 26),

        backButtonText:
          scale(18, 14, 18),

        maxCardWidth:
          useSideCart
            ? Math.min(detailWidth - 24, 950)
            : clamp(width - 28, 300, 680),

        cartPhoneMinHeight,
        cartPhoneListMaxHeight,
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
    useCallback(async () => {
      if (!routeItem?.id) {
        return;
      }

      try {
        const response =
          await getMenu();

        console.log(
          'ITEM DETAIL MENU DEBUG SOURCE:',
          response?.debug_source
        );

        console.log(
          'ITEM DETAIL EXPECTED DEBUG SOURCE:',
          EXPECTED_MENU_DEBUG_SOURCE
        );

        console.log(
          'ITEM DETAIL FIRST MENU ITEM:',
          response?.data?.[0]
        );

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
              String(menuItem.id) ===
              String(routeItem.id)
          );

        if (freshItem) {
          console.log(
            'ITEM DETAIL FRESH ITEM:',
            {
              id:
                freshItem?.id,
              name:
                freshItem?.name,
              is_available:
                freshItem?.is_available,
              max_order_quantity:
                freshItem?.max_order_quantity,
              remaining_today:
                freshItem?.remaining_today,
              stock_label:
                freshItem?.stock_label,
              unavailable_reason:
                freshItem?.unavailable_reason,
              mobile_available:
                isBackendAvailableItem(
                  freshItem
                ),
            }
          );

          setLiveItem(freshItem);
        }
      } catch (error) {
        console.log(
          'ITEM INVENTORY REFRESH ERROR:',
          error?.message
        );
      }
    }, [
      routeItem?.id,
      syncMenuInventory,
    ]);

  useFocusEffect(
    useCallback(() => {
      refreshLiveItem();
    }, [refreshLiveItem])
  );

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

  const getCurrentCartQuantityForItem = (
    data
  ) => {
    const targetItemId =
      getItemId(data);

    const existingCartItem =
      cartItems.find(
        (cartItem) =>
          String(getItemId(cartItem)) ===
          String(targetItemId)
      );

    return Number(
      existingCartItem?.quantity || 0
    );
  };

  const imageUri =
    getItemImage(item);

  const customItem =
    isIngredientCustomItem(item);

  const allowedQuantity =
    getAllowedOrderQuantity(item);

  const currentCartQuantity =
    getCurrentCartQuantityForItem(item);

  const isAvailable =
    item
      ? isBackendAvailableItem(item)
      : false;

  const canAddMoreCurrentItem =
    customItem
      ? isAvailable &&
        currentCartQuantity < 1
      : isAvailable &&
        allowedQuantity > 0 &&
        currentCartQuantity < allowedQuantity;

  console.log(
    'ITEM DETAIL STOCK DEBUG:',
    {
      id: item?.id,
      name: item?.name,
      is_available: item?.is_available,
      max_order_quantity: item?.max_order_quantity,
      remaining_today: item?.remaining_today,
      stock_label: item?.stock_label,
      daily_inventory_label:
        item?.daily_inventory_label,
      unavailable_reason:
        item?.unavailable_reason,
      inventory_type: item?.inventory_type,
      maxQty: allowedQuantity,
      isAvailable,
    }
  );

  const isLowStock =
    !customItem &&
    isAvailable &&
    allowedQuantity > 0 &&
    allowedQuantity <= 5;

  const availabilityText =
    getBackendStockMessage(item);

  const itemDescription =
    getItemDescription(item);

  const flavorTags =
    getFlavorTags(item);

  const mealType =
    getMealType(item);

  const fetchRecommendations = useCallback(async () => {
    try {
      setLoadingRecommendations(true);

      const response =
        await getDishRecommendations({
          selectedItem: item,
          cartItems,
        });

      if (response.success) {
        const recommendedItems =
          Array.isArray(response.data)
            ? response.data
            : [];

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
  }, [
    item,
    cartItems,
    mergeInventoryItems,
  ]);

  useEffect(() => {
    if (item?.name) {
      fetchRecommendations();
    }
  }, [
    item?.id,
    item?.name,
    fetchRecommendations,
  ]);

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

    if (!isBackendAvailableItem(item)) {
      Alert.alert(
        'Unavailable',
        getBackendStockMessage(item)
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

      if (currentCartQuantity >= 1) {
        Alert.alert(
          'Already Added',
          'Chef Oppa Special can only be added once per order.'
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
        max_order_quantity: 1,
        remaining_today: 1,
        is_available: true,
      });

      setSpecialRequest('');
      return;
    }

    if (allowedQuantity <= 0) {
      Alert.alert(
        'Sold Out',
        getBackendStockMessage(item)
      );
      return;
    }

    if (!canAddMoreCurrentItem) {
      Alert.alert(
        'Limited Stock',
        `Only ${allowedQuantity} order(s) available based on ingredient stock.`
      );
      return;
    }

    addToCart({
      ...item,
      max_order_quantity:
        allowedQuantity,
      remaining_today:
        item?.remaining_today,
      stock_label:
        item?.stock_label,
      daily_inventory_label:
        item?.daily_inventory_label,
      is_available:
        item?.is_available,
      unavailable_reason:
        item?.unavailable_reason,
      inventory_type:
        item?.inventory_type,
      ingredients:
        Array.isArray(item?.ingredients)
          ? item.ingredients
          : [],
    });
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

    if (
      !isBackendAvailableItem(
        recommendedItem
      )
    ) {
      Alert.alert(
        'Unavailable',
        getBackendStockMessage(
          recommendedItem
        )
      );
      return;
    }

    const recommendedCustom =
      isIngredientCustomItem(
        recommendedItem
      );

    if (recommendedCustom) {
      handleOpenRecommendedItem(
        recommendedItem
      );
      return;
    }

    const allowedRecommendedQuantity =
      getAllowedOrderQuantity(
        recommendedItem
      );

    const currentRecommendedQuantity =
      getCurrentCartQuantityForItem(
        recommendedItem
      );

    if (
      allowedRecommendedQuantity <= 0 ||
      currentRecommendedQuantity >=
        allowedRecommendedQuantity
    ) {
      Alert.alert(
        'Limited Stock',
        `Only ${allowedRecommendedQuantity} order(s) available based on ingredient stock.`
      );

      return;
    }

    addToCart({
      ...recommendedItem,
      max_order_quantity:
        allowedRecommendedQuantity,
      remaining_today:
        recommendedItem?.remaining_today,
      stock_label:
        recommendedItem?.stock_label,
      daily_inventory_label:
        recommendedItem?.daily_inventory_label,
      is_available:
        recommendedItem?.is_available,
      unavailable_reason:
        recommendedItem?.unavailable_reason,
      inventory_type:
        recommendedItem?.inventory_type,
      ingredients:
        Array.isArray(
          recommendedItem?.ingredients
        )
          ? recommendedItem.ingredients
          : [],
    });
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
    const enrichedItem =
      getEnrichedItem(cartItem);

    if (
      isIngredientCustomItem(enrichedItem)
    ) {
      return;
    }

    if (
      !isBackendAvailableItem(
        enrichedItem
      )
    ) {
      Alert.alert(
        'Unavailable',
        getBackendStockMessage(
          enrichedItem
        )
      );

      return;
    }

    const allowedCartQuantity =
      getAllowedOrderQuantity(
        enrichedItem
      );

    if (
      allowedCartQuantity <= 0 ||
      Number(cartItem.quantity || 0) >=
        allowedCartQuantity
    ) {
      Alert.alert(
        'Limited Stock',
        `Only ${allowedCartQuantity} order(s) available based on ingredient stock.`
      );

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

    const invalidItems =
      cartItems.filter((cartItem) => {
        const enrichedItem =
          getEnrichedItem(cartItem);

        return (
          !isIngredientCustomItem(enrichedItem) &&
          !isBackendAvailableItem(
            enrichedItem
          )
        );
      });

    if (invalidItems.length > 0) {
      const firstInvalid =
        invalidItems[0];

      Alert.alert(
        'Unavailable Item',
        getBackendStockMessage(
          firstInvalid
        )
      );

      return;
    }

    const overLimitItems =
      cartItems.filter((cartItem) => {
        const enrichedItem =
          getEnrichedItem(cartItem);

        if (
          isIngredientCustomItem(enrichedItem)
        ) {
          return false;
        }

        const allowedCartQuantity =
          getAllowedOrderQuantity(
            enrichedItem
          );

        return (
          allowedCartQuantity <= 0 ||
          Number(cartItem.quantity || 0) >
            allowedCartQuantity
        );
      });

    if (overLimitItems.length > 0) {
      Alert.alert(
        'Limited Stock',
        'Some items exceed the latest ingredient stock quantity. Please adjust your cart before confirming your order.'
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

    const recommendedCustom =
      isIngredientCustomItem(
        recommendedItem
      );

    const recommendedAvailable =
      isBackendAvailableItem(
        recommendedItem
      );

    return (
      <View
        style={[
          styles.recommendationCard,
          {
            width:
              responsive.recommendationWidth,
            minHeight:
              responsive.recommendationMinHeight,
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

          <View style={styles.recommendationTextBox}>
            <Text
              style={[
                styles.recommendationName,
                {
                  fontSize:
                    responsive.recommendationName,
                  lineHeight:
                    responsive.recommendationLine,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {recommendedItem.name}
            </Text>

            <Text
              style={[
                styles.recommendationPrice,
                {
                  fontSize:
                    responsive.recommendationPrice,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {recommendedCustom
                ? 'To be confirmed'
                : `₱${formatMoney(recommendedItem.price)}`}
            </Text>
          </View>
        </TouchableOpacity>

        <View
          style={[
            styles.recommendationRight,
            {
              width:
                responsive.recommendationRightWidth,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.recommendationAddButton,
              {
                paddingHorizontal:
                  responsive.recommendationAddPaddingH,
              },
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
                ? handleOpenRecommendedItem(
                    recommendedItem
                  )
                : handleAddRecommendedItem(
                    recommendedItem
                  )
            }
          >
            <Text
              style={[
                styles.recommendationAddText,
                {
                  fontSize:
                    responsive.recommendationAddText,
                },
              ]}
              numberOfLines={1}
            >
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
      isIngredientCustomItem(
        enrichedItem
      );

    const availableInventoryItem =
      customCartItem ||
      isBackendAvailableItem(
        enrichedItem
      );

    const allowedCartQuantity =
      customCartItem
        ? 1
        : getAllowedOrderQuantity(
            enrichedItem
          );

    const atMaxQuantity =
      customCartItem ||
      !availableInventoryItem ||
      allowedCartQuantity <= 0 ||
      Number(cartItem.quantity || 0) >=
        allowedCartQuantity;

    return (
      <View
        style={[
          styles.cartItem,
          !responsive.useSideCart &&
          styles.cartItemBottom,
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

            {!customCartItem ? (
              <Text style={styles.cartStockText}>
                {getBackendStockMessage(
                  enrichedItem
                )}
              </Text>
            ) : null}

            {!customCartItem &&
            !availableInventoryItem ? (
              <Text style={styles.cartInvalidText}>
                {getBackendStockMessage(
                  enrichedItem
                )}
              </Text>
            ) : null}

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
              handleRemoveItem(cartItem)
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
                atMaxQuantity &&
                styles.qtyButtonDisabled,
              ]}
              disabled={atMaxQuantity}
              onPress={() =>
                handleIncreaseQuantity(
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
      <View style={styles.errorContainer}>
        <Text
          style={[
            styles.errorText,
            {
              fontSize:
                responsive.errorText,
            },
          ]}
        >
          Item not found
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
          'bottom',
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
                  responsive.topBarPaddingH,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.headerBackButton}
              onPress={() =>
                navigation.goBack()
              }
            >
              <Text
                style={[
                  styles.headerBackText,
                  {
                    fontSize:
                      responsive.topText,
                  },
                ]}
              >
                ‹
              </Text>
            </TouchableOpacity>

            <Text
              style={[
                styles.topBarText,
                {
                  fontSize:
                    responsive.topText,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Item Details
            </Text>

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
            <View style={styles.detailSection}>
              <ScrollView
                style={styles.detailScroll}
                contentContainerStyle={[
                  styles.detailScrollContent,
                  {
                    padding:
                      responsive.detailPadding,
                    paddingBottom:
                      responsive.detailBottomPadding,
                  },
                ]}
                showsVerticalScrollIndicator={false}
              >
                <View
                  style={[
                    styles.detailCard,
                    {
                      padding:
                        responsive.cardPadding,
                      borderRadius:
                        responsive.cardRadius,
                      maxWidth:
                        responsive.maxCardWidth,
                    },
                    customItem &&
                    styles.customDetailCard,
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
                          styles.foodEmoji,
                          {
                            fontSize:
                              responsive.emoji,
                          },
                        ]}
                      >
                        🍽️
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.itemName,
                      {
                        fontSize:
                          responsive.itemName,
                        lineHeight:
                          responsive.itemName + 5,
                      },
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
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
                      customItem &&
                      styles.customPrice,
                    ]}
                  >
                    {customItem
                      ? 'To be confirmed'
                      : `₱${formatMoney(item.price)}`}
                  </Text>

                  <Text
                    style={[
                      styles.categoryText,
                      {
                        fontSize:
                          responsive.category,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.category || 'Uncategorized'}
                  </Text>

                  {mealType ? (
                    <Text
                      style={[
                        styles.mealTypeText,
                        {
                          fontSize:
                            responsive.category,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {mealType}
                    </Text>
                  ) : null}

                  {flavorTags.length > 0 ? (
                    <View style={styles.tagWrap}>
                      {flavorTags.map(
                        (tag, index) => (
                          <View
                            key={`${tag}-${index}`}
                            style={styles.tagPill}
                          >
                            <Text
                              style={[
                                styles.tagText,
                                {
                                  fontSize:
                                    responsive.tagText,
                                },
                              ]}
                            >
                              {tag}
                            </Text>
                          </View>
                        )
                      )}
                    </View>
                  ) : null}

                  <Text
                    style={[
                      isAvailable
                        ? isLowStock
                          ? styles.lowStockText
                          : styles.availableText
                        : styles.notAvailableText,
                      {
                        fontSize:
                          responsive.stockText,
                      },
                    ]}
                  >
                    {availabilityText}
                  </Text>

                  {!customItem &&
                  isAvailable &&
                  allowedQuantity > 0 ? (
                    <Text
                      style={[
                        styles.limitText,
                        {
                          fontSize:
                            responsive.limitText,
                        },
                      ]}
                    >
                      Only {allowedQuantity} order(s) available based on ingredient stock.
                    </Text>
                  ) : null}

                  {itemDescription ? (
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
                      {itemDescription}
                    </Text>
                  ) : (
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
                      No description available.
                    </Text>
                  )}

                  {customItem ? (
                    <View style={styles.customRequestBox}>
                      <Text
                        style={[
                          styles.inputLabel,
                          {
                            fontSize:
                              responsive.label,
                          },
                        ]}
                      >
                        Describe your custom request
                      </Text>

                      <TextInput
                        value={specialRequest}
                        onChangeText={
                          setSpecialRequest
                        }
                        placeholder="Example: Less spicy, add cheese, custom dish request..."
                        placeholderTextColor="#999"
                        multiline
                        textAlignVertical="top"
                        style={[
                          styles.requestInput,
                          {
                            fontSize:
                              responsive.inputFont,
                            minHeight:
                              responsive.inputHeight,
                          },
                        ]}
                      />

                      <Text style={styles.customHelpText}>
                        Staff will confirm the final price and availability.
                      </Text>
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
                        !canAddMoreCurrentItem ||
                        !canOrder) &&
                      styles.addToOrderButtonDisabled,
                    ]}
                    disabled={
                      !isAvailable ||
                      !canAddMoreCurrentItem ||
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
                      {customItem
                        ? currentCartQuantity >= 1
                          ? 'Already Added'
                          : 'Add Custom Request'
                        : !isAvailable
                          ? 'Unavailable'
                          : !canAddMoreCurrentItem
                            ? 'Max Quantity Reached'
                            : 'Add to Order'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <View style={styles.fixedPairingSection}>
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
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.fixedPairingList}
                  />
                ) : (
                  <Text style={styles.noRecommendationText}>
                    No recommendations available yet.
                  </Text>
                )}
              </View>
            </View>

            <View
              style={[
                styles.cartSidebar,
                responsive.useSideCart &&
                styles.cartSidebarSide,
                {
                  width:
                    responsive.useSideCart
                      ? responsive.cartWidth
                      : '100%',
                  height:
                    responsive.useSideCart
                      ? '100%'
                      : undefined,
                  minHeight:
                    responsive.useSideCart
                      ? undefined
                      : responsive.cartPhoneMinHeight,
                  maxHeight:
                    responsive.useSideCart
                      ? undefined
                      : responsive.cartPhoneMinHeight,
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
                <View style={styles.emptyCartBox}>
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
                </View>
              ) : (
                <FlatList
                  data={cartItems}
                  keyExtractor={(cartItem) =>
                    String(getItemId(cartItem))
                  }
                  renderItem={renderCartItem}
                  horizontal={
                    !responsive.useSideCart
                  }
                  showsHorizontalScrollIndicator={
                    !responsive.useSideCart
                  }
                  showsVerticalScrollIndicator={
                    responsive.useSideCart
                  }
                  persistentScrollbar={true}
                  indicatorStyle="black"
                  keyboardShouldPersistTaps="handled"
                  style={[
                    responsive.useSideCart
                      ? styles.cartListSide
                      : [
                          styles.cartListStacked,
                          {
                            maxHeight:
                              responsive.cartPhoneListMaxHeight,
                            minHeight: 82,
                          },
                        ],
                  ]}
                  contentContainerStyle={{
                    paddingBottom:
                      responsive.useSideCart
                        ? 14
                        : 4,
                    paddingRight:
                      responsive.useSideCart
                        ? 8
                        : 0,
                    gap:
                      responsive.useSideCart
                        ? 0
                        : 12,
                  }}
                />
              )}

              {cartItems.length > 1 ? (
                <Text style={styles.cartScrollHint}>
                  {responsive.useSideCart
                    ? 'Scroll to see more items'
                    : 'Swipe to see more items'}
                </Text>
              ) : null}

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

                {cartItems.some(
                  isIngredientCustomItem
                ) ? (
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

    topBar: {
      backgroundColor: '#b8b3b3',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
    },

    headerBackButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
    },

    headerBackText: {
      color: '#f68c45',
      fontWeight: '900',
      marginTop: -3,
    },

    topBarText: {
      color: '#fff',
      fontWeight: '900',
      flex: 1,
      textAlign: 'center',
    },

    tableText: {
      color: '#fff',
      fontWeight: '900',
      minWidth: 86,
      textAlign: 'right',
    },

    contentArea: {
      flex: 1,
      minHeight: 0,
    },

    detailSection: {
      flex: 1,
      minHeight: 0,
      backgroundColor: '#efefef',
    },

    detailScroll: {
      flex: 1,
      minHeight: 0,
    },

    detailScrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 10,
    },

    detailCard: {
      width: '100%',
      backgroundColor: '#fff',
      borderWidth: 1.5,
      borderColor: '#f0b287',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },

    customDetailCard: {
      backgroundColor: '#fffaf5',
      borderColor: '#f68c45',
    },

    imageCircle: {
      backgroundColor: '#ececec',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      marginBottom: 12,
    },

    itemImage: {
      width: '100%',
      height: '100%',
    },

    foodEmoji: {
      textAlign: 'center',
    },

    itemName: {
      color: '#222',
      fontWeight: '900',
      textAlign: 'center',
      marginTop: 4,
    },

    itemPrice: {
      color: '#777',
      fontWeight: '800',
      marginTop: 8,
      textAlign: 'center',
    },

    customPrice: {
      color: '#f68c45',
      fontWeight: '900',
    },

    categoryText: {
      color: '#999',
      fontWeight: '800',
      marginTop: 4,
      textAlign: 'center',
    },

    mealTypeText: {
      color: '#f68c45',
      fontWeight: '800',
      marginTop: 3,
      textAlign: 'center',
      textTransform: 'capitalize',
    },

    tagWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 6,
      marginTop: 10,
      marginBottom: 2,
    },

    tagPill: {
      backgroundColor: '#fff4eb',
      borderWidth: 1,
      borderColor: '#f0b287',
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 9,
    },

    tagText: {
      color: '#f68c45',
      fontWeight: '900',
      textTransform: 'capitalize',
    },

    availableText: {
      color: '#4CAF50',
      fontWeight: '900',
      marginTop: 12,
      textAlign: 'center',
    },

    lowStockText: {
      color: '#e67e22',
      fontWeight: '900',
      marginTop: 12,
      textAlign: 'center',
    },

    notAvailableText: {
      color: '#b00020',
      fontWeight: '900',
      marginTop: 12,
      textAlign: 'center',
    },

    limitText: {
      color: '#555',
      fontWeight: '800',
      textAlign: 'center',
      marginTop: 5,
    },

    description: {
      color: '#555',
      textAlign: 'center',
      marginTop: 14,
      fontWeight: '600',
    },

    customRequestBox: {
      width: '100%',
      marginTop: 18,
    },

    inputLabel: {
      color: '#333',
      fontWeight: '900',
      marginBottom: 8,
    },

    requestInput: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#f0b287',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: '#222',
      fontWeight: '700',
    },

    customHelpText: {
      color: '#777',
      fontWeight: '700',
      fontSize: 12,
      marginTop: 7,
      lineHeight: 17,
    },

    addToOrderButton: {
      marginTop: 20,
      backgroundColor: '#f68c45',
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },

    addToOrderButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    addToOrderText: {
      color: '#fff',
      fontWeight: '900',
      textAlign: 'center',
      includeFontPadding: false,
    },

    fixedPairingSection: {
      width: '100%',
      backgroundColor: '#efefef',
      paddingTop: 8,
      paddingBottom: 8,
    },

    fixedPairingList: {
      paddingHorizontal: 4,
      paddingBottom: 4,
    },

    recommendationTitle: {
      fontWeight: '900',
      color: '#333',
      marginBottom: 8,
      paddingHorizontal: 14,
    },

    noRecommendationText: {
      color: '#777',
      fontWeight: '700',
      paddingHorizontal: 14,
      paddingBottom: 6,
    },

    recommendationCard: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#f0b287',
      borderRadius: 18,
      marginHorizontal: 7,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },

    recommendationCardDisabled: {
      opacity: 0.45,
    },

    recommendationLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
    },

    recommendationCircle: {
      backgroundColor: '#ececec',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      marginRight: 10,
    },

    recommendationImage: {
      width: '100%',
      height: '100%',
    },

    recommendationEmoji: {
      fontSize: 32,
    },

    recommendationTextBox: {
      flex: 1,
      minWidth: 0,
    },

    recommendationName: {
      color: '#222',
      fontWeight: '900',
    },

    recommendationPrice: {
      color: '#f68c45',
      fontWeight: '800',
      marginTop: 3,
    },

    recommendationRight: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },

    recommendationAddButton: {
      backgroundColor: '#f68c45',
      borderRadius: 12,
      paddingVertical: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },

    recommendationAddButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    recommendationAddText: {
      color: '#fff',
      fontWeight: '900',
    },

    cartSidebar: {
      backgroundColor: '#fff',
      borderLeftColor: '#ddd',
      borderTopColor: '#ddd',
      flexShrink: 0,
      minHeight: 0,
    },

    cartSidebarSide: {
      minHeight: 0,
    },

    cartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      flexShrink: 0,
    },

    cartIcon: {
      marginRight: 8,
    },

    cartTitle: {
      fontWeight: '900',
      color: '#222',
    },

    emptyCartBox: {
      flex: 1,
      minHeight: 0,
    },

    emptyCartText: {
      color: '#777',
      marginTop: 4,
      borderBottomWidth: 1,
      borderBottomColor: '#dddddd',
      paddingBottom: 8,
      fontWeight: '700',
    },

    cartListSide: {
      flex: 1,
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
    },

    cartListStacked: {
      flexGrow: 0,
      minHeight: 72,
    },

    cartScrollHint: {
      color: '#999',
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'center',
      paddingTop: 2,
      paddingBottom: 4,
      flexShrink: 0,
    },

    cartItem: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#eeeeee',
      minWidth: 170,
      maxWidth: 230,
    },

    cartItemBottom: {
      borderBottomWidth: 0,
      borderRightWidth: 1,
      borderRightColor: '#eeeeee',
      paddingRight: 10,
    },

    cartItemTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },

    cartItemInfo: {
      flex: 1,
      paddingRight: 8,
    },

    cartItemName: {
      fontWeight: '900',
      color: '#222',
    },

    cartItemPrice: {
      fontWeight: '800',
      color: '#f68c45',
      marginTop: 4,
    },

    cartStockText: {
      marginTop: 5,
      color: '#666',
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 16,
    },

    cartInvalidText: {
      marginTop: 5,
      color: '#b00020',
      fontSize: 12,
      fontWeight: '900',
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

    removeText: {
      fontWeight: '900',
      color: '#999',
    },

    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
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
      fontWeight: '900',
    },

    qtyText: {
      fontWeight: '900',
      marginHorizontal: 12,
    },

    cartFooter: {
      borderTopWidth: 1,
      borderTopColor: '#dddddd',
      paddingTop: 8,
      paddingBottom: 4,
      marginTop: 'auto',
      flexShrink: 0,
    },

    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      gap: 10,
    },

    totalLabel: {
      fontWeight: '900',
      color: '#333',
    },

    totalValue: {
      fontWeight: '900',
      color: '#f68c45',
      flexShrink: 1,
      textAlign: 'right',
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
      marginBottom: 8,
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
      fontWeight: '900',
    },

    errorContainer: {
      flex: 1,
      backgroundColor: '#efefef',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },

    errorText: {
      color: '#333',
      fontWeight: '900',
      marginBottom: 16,
    },

    backButton: {
      backgroundColor: '#f68c45',
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },

    backButtonText: {
      color: '#fff',
      fontWeight: '900',
    },
  });