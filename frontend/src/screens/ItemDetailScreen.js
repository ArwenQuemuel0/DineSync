import React, {
  useCallback,
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
  isItemOrderable,
  isOutOfStock,
  canIncreaseQuantity,
  getAvailabilityDisplayText,
  shouldShowLowStockWarning,
  isCustomItem,
} from '../utils/inventory';

const VALID_NORMAL_INVENTORY_TYPES = [
  'per_order',
  'per_head',
];

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase();
};

const normalizeInventoryType = (value) => {
  return normalizeText(value)
    .replace(/[-\s]+/g, '_');
};

const isAvailableTrue = (value) => {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    normalizeText(value) === 'true' ||
    normalizeText(value) === 'yes' ||
    normalizeText(value) === 'available'
  );
};

const hasInventoryType = (item) => {
  return (
    item?.inventory_type !== null &&
    item?.inventory_type !== undefined &&
    String(item.inventory_type).trim() !== ''
  );
};

const hasDailyLimit = (item) => {
  return (
    item?.daily_limit !== null &&
    item?.daily_limit !== undefined &&
    String(item.daily_limit).trim() !== ''
  );
};

const toNumber = (value) => {
  const numberValue =
    Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
};

const getRemainingToday = (item) => {
  return toNumber(
    item?.remaining_today
  );
};

const getMaxOrderQuantity = (item) => {
  return toNumber(
    item?.max_order_quantity
  );
};

const getAllowedOrderQuantity = (item) => {
  if (!item) {
    return 0;
  }

  if (isCustomItem(item)) {
    return 1;
  }

  const maxOrderQuantity =
    getMaxOrderQuantity(item);

  const remainingToday =
    getRemainingToday(item);

  if (
    maxOrderQuantity > 0 &&
    remainingToday > 0
  ) {
    return Math.min(
      maxOrderQuantity,
      remainingToday
    );
  }

  if (maxOrderQuantity > 0) {
    return maxOrderQuantity;
  }

  if (remainingToday > 0) {
    return remainingToday;
  }

  return 0;
};

const isValidDailyInventoryMenuItem = (item) => {
  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  const available =
    isAvailableTrue(
      item?.is_available
    );

  if (!available) {
    return false;
  }

  if (!hasInventoryType(item)) {
    return false;
  }

  if (inventoryType === 'custom') {
    return true;
  }

  if (
    !VALID_NORMAL_INVENTORY_TYPES.includes(
      inventoryType
    )
  ) {
    return false;
  }

  if (!hasDailyLimit(item)) {
    return false;
  }

  const remainingToday =
    getRemainingToday(item);

  const maxOrderQuantity =
    getMaxOrderQuantity(item);

  return (
    remainingToday > 0 ||
    maxOrderQuantity > 0
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
    React.useMemo(() => {
      const shortest =
        Math.min(width, height);

      const isPhone =
        shortest < 600;

      const isLandscape =
        width > height;

      const compactVertical =
        !isLandscape;

      const compactLandscape =
        isLandscape && height < 650;

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
        isLandscape &&
        width >= 760 &&
        height >= 430;

      const cartWidth =
        useSideCart
          ? clamp(width * 0.24, 230, 330)
          : '100%';

      const detailWidth =
        useSideCart
          ? width - cartWidth
          : width;

      const topBarHeight =
        compactLandscape
          ? scale(44, 40, 48)
          : isPhone
            ? scale(58, 52, 62)
            : scale(64, 54, 68);

      const cartPhoneMinHeight =
        clamp(height * 0.09, 88, 112);

      const cartPhoneListMaxHeight =
        clamp(height * 0.045, 40, 56);

      const detailAvailableHeight =
        height -
        topBarHeight -
        scale(18, 12, 24);

      const portraitCardMinHeight =
        !useSideCart
          ? Math.max(
            0,
            height -
            topBarHeight -
            cartPhoneMinHeight -
            scale(42, 32, 50)
          )
          : undefined;

      const landscapeCardMinHeight =
        useSideCart
          ? Math.max(
            0,
            detailAvailableHeight -
            scale(18, 12, 24)
          )
          : undefined;

      const detailCardMinHeight =
        useSideCart
          ? landscapeCardMinHeight
          : portraitCardMinHeight;

      const imageSize =
        compactLandscape
          ? scale(82, 68, 92)
          : compactVertical
            ? isPhone
              ? scale(98, 78, 110)
              : scale(132, 106, 146)
            : scale(148, 108, 164);

      const recommendationWidth =
        isPhone
          ? clamp(width * 0.72, 250, 310)
          : useSideCart
            ? clamp(detailWidth * 0.43, 280, 380)
            : clamp(width * 0.42, 285, 360);

      const recommendationRightWidth =
        compactLandscape || compactVertical
          ? scale(66, 56, 72)
          : scale(94, 82, 100);

      const recommendationMinHeight =
        compactLandscape
          ? scale(64, 56, 72)
          : compactVertical
            ? scale(86, 76, 92)
            : scale(108, 92, 116);

      return {
        isPhone,
        compactVertical,
        compactLandscape,
        useSideCart,
        cartWidth,

        topSafeExtra: 0,

        bottomSafeExtra:
          Math.max(insets.bottom + 2, 4),

        topBarHeight,

        topBarPaddingH:
          isPhone
            ? scale(14, 10, 16)
            : scale(20, 12, 22),

        topText:
          compactLandscape
            ? scale(17, 14, 18)
            : isPhone
              ? scale(18, 15, 20)
              : scale(26, 18, 28),

        tableText:
          compactLandscape
            ? scale(16, 13, 17)
            : isPhone
              ? scale(16, 13, 17)
              : scale(22, 15, 22),

        detailPadding:
          compactLandscape
            ? scale(7, 5, 8)
            : useSideCart
              ? scale(12, 8, 14)
              : scale(8, 5, 9),

        detailBottomPadding:
          compactLandscape || compactVertical
            ? scale(2, 0, 4)
            : scale(6, 4, 8),

        cardPadding:
          compactLandscape
            ? scale(10, 7, 12)
            : compactVertical
              ? scale(14, 10, 16)
              : scale(20, 14, 22),

        cardRadius:
          scale(24, 16, 26),

        detailCardMinHeight,

        cardJustifyContent:
          compactLandscape || compactVertical
            ? 'space-evenly'
            : 'center',

        imageSize,

        imageRadius:
          imageSize / 2,

        emoji:
          compactLandscape
            ? scale(46, 36, 50)
            : isPhone
              ? scale(58, 42, 62)
              : scale(78, 52, 82),

        itemName:
          compactLandscape
            ? scale(24, 19, 26)
            : compactVertical
              ? isPhone
                ? scale(22, 18, 23)
                : scale(31, 24, 33)
              : scale(34, 26, 36),

        itemPrice:
          compactLandscape
            ? scale(18, 15, 20)
            : compactVertical
              ? isPhone
                ? scale(18, 15, 19)
                : scale(23, 19, 24)
              : scale(28, 21, 30),

        category:
          compactLandscape || compactVertical
            ? scale(13, 10, 14)
            : scale(16, 13, 17),

        tagText:
          compactLandscape
            ? scale(9, 7, 10)
            : compactVertical
              ? scale(10, 8, 11)
              : scale(12, 10, 13),

        stockText:
          compactLandscape
            ? scale(13, 10, 14)
            : compactVertical
              ? scale(15, 12, 16)
              : scale(18, 14, 19),

        limitText:
          compactLandscape || compactVertical
            ? scale(12, 10, 13)
            : scale(15, 12, 16),

        description:
          compactLandscape
            ? scale(12, 10, 13)
            : compactVertical
              ? scale(14, 12, 15)
              : scale(17, 13, 18),

        descriptionLine:
          compactLandscape
            ? scale(15, 13, 16)
            : compactVertical
              ? scale(19, 16, 20)
              : scale(24, 20, 25),

        label:
          scale(17, 13, 18),

        inputFont:
          scale(16, 13, 16),

        inputHeight:
          isPhone
            ? scale(92, 78, 96)
            : scale(105, 84, 110),

        buttonText:
          compactLandscape || compactVertical
            ? scale(15, 12, 16)
            : scale(20, 15, 21),

        buttonPaddingV:
          compactLandscape
            ? scale(7, 5, 8)
            : compactVertical
              ? scale(8, 6, 9)
              : scale(13, 10, 14),

        buttonPaddingH:
          compactLandscape || compactVertical
            ? scale(24, 18, 28)
            : scale(40, 26, 44),

        recommendationTitle:
          compactLandscape || compactVertical
            ? scale(16, 13, 17)
            : scale(20, 16, 21),

        recommendationWidth,
        recommendationRightWidth,
        recommendationMinHeight,

        recommendationCircle:
          compactLandscape
            ? scale(40, 32, 46)
            : compactVertical
              ? scale(50, 42, 56)
              : scale(72, 58, 78),

        recommendationName:
          compactLandscape
            ? scale(12, 10, 13)
            : compactVertical
              ? scale(13, 10, 14)
              : scale(16, 13, 17),

        recommendationLine:
          compactLandscape
            ? scale(14, 12, 15)
            : compactVertical
              ? scale(16, 13, 17)
              : scale(20, 16, 21),

        recommendationPrice:
          compactLandscape
            ? scale(11, 9, 12)
            : compactVertical
              ? scale(12, 10, 13)
              : scale(15, 12, 16),

        recommendationAddText:
          compactLandscape
            ? scale(11, 9, 12)
            : compactVertical
              ? scale(12, 10, 13)
              : scale(14, 12, 15),

        recommendationAddPaddingH:
          compactLandscape || compactVertical
            ? scale(10, 8, 12)
            : scale(20, 16, 22),

        recommendationAddPaddingV:
          compactLandscape
            ? scale(4, 3, 5)
            : compactVertical
              ? scale(5, 4, 6)
              : scale(7, 6, 8),

        recommendationAddMinWidth:
          compactLandscape || compactVertical
            ? scale(48, 40, 54)
            : scale(72, 64, 76),

        imageMarginBottom:
          compactLandscape ? 4 : compactVertical ? 6 : 14,

        priceMarginTop:
          compactLandscape || compactVertical ? 3 : 8,

        categoryMarginTop:
          compactLandscape || compactVertical ? 2 : 6,

        tagMarginTop:
          compactLandscape ? 4 : compactVertical ? 5 : 8,

        stockMarginTop:
          compactLandscape ? 4 : compactVertical ? 5 : 8,

        limitMarginTop:
          compactLandscape || compactVertical ? 3 : 6,

        descriptionMarginTop:
          compactLandscape ? 5 : compactVertical ? 7 : 14,

        addButtonMarginTop:
          compactLandscape ? 7 : compactVertical ? 9 : 20,

        recommendationMarginTop:
          compactLandscape ? 7 : compactVertical ? 10 : 22,

        recommendationTitleMarginBottom:
          compactLandscape ? 5 : compactVertical ? 6 : 12,

        recommendationCardPaddingH:
          compactLandscape ? 8 : compactVertical ? 9 : 14,

        recommendationCardPaddingV:
          compactLandscape ? 5 : compactVertical ? 6 : 10,

        recommendationCardMarginH:
          compactLandscape || compactVertical ? 5 : 8,

        recommendationCircleMarginRight:
          compactLandscape ? 7 : compactVertical ? 8 : 12,

        sidebarPaddingH:
          compactLandscape
            ? scale(10, 8, 12)
            : scale(14, 10, 16),

        sidebarPaddingT:
          useSideCart
            ? scale(10, 7, 12)
            : scale(5, 3, 6),

        cartIcon:
          compactLandscape
            ? scale(20, 16, 21)
            : scale(22, 17, 23),

        cartTitle:
          compactVertical
            ? scale(16, 13, 17)
            : scale(20, 15, 21),

        cartItemName:
          compactVertical
            ? scale(11, 9, 12)
            : scale(14, 11, 15),

        cartItemPrice:
          compactVertical
            ? scale(11, 9, 12)
            : scale(13, 11, 14),

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
          compactVertical
            ? scale(13, 11, 14)
            : scale(17, 13, 18),

        totalValue:
          compactVertical
            ? scale(15, 12, 16)
            : scale(20, 16, 21),

        checkoutText:
          compactVertical
            ? scale(12, 10, 13)
            : scale(15, 12, 16),

        checkoutPadding:
          compactVertical
            ? scale(6, 5, 7)
            : scale(10, 7, 11),

        errorText:
          scale(26, 18, 26),

        backButtonText:
          scale(18, 14, 18),

        maxCardWidth:
          useSideCart
            ? Math.min(detailWidth - 16, 980)
            : clamp(width - 28, 300, 700),

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

        const visibleItems =
          response.data.filter(
            isValidDailyInventoryMenuItem
          );

        syncMenuInventory(
          visibleItems
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
    useCallback(() => {
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

      if (response.success) {
        const recommendedItems =
          (response.data || []).filter(
            isValidDailyInventoryMenuItem
          );

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

  const getCurrentCartQuantityForItem = (
    data
  ) => {
    const targetItemId =
      getItemId(data);

    const existingCartItem =
      cartItems.find(
        (cartItem) =>
          String(
            getItemId(cartItem)
          ) ===
          String(targetItemId)
      );

    return Number(
      existingCartItem?.quantity || 0
    );
  };

  const imageUri =
    getItemImage(item);

  const customItem =
    isCustomItem(item);

  const isValidForMobile =
    isValidDailyInventoryMenuItem(item);

  const allowedQuantity =
    getAllowedOrderQuantity(item);

  const currentCartQuantity =
    getCurrentCartQuantityForItem(item);

  const canAddMoreCurrentItem =
    customItem
      ? currentCartQuantity < 1
      : allowedQuantity > 0 &&
      currentCartQuantity < allowedQuantity;

  const isAvailable =
    isValidForMobile &&
    isItemOrderable(item) &&
    (
      customItem ||
      allowedQuantity > 0
    );

  const isLowStock =
    shouldShowLowStockWarning(item);

  const availabilityText =
    customItem
      ? 'Custom request available'
      : isValidForMobile
        ? getAvailabilityDisplayText(item)
        : 'Not enabled in Daily Menu Inventory';

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

    if (
      !isValidDailyInventoryMenuItem(item)
    ) {
      Alert.alert(
        'Unavailable',
        'This item is not enabled in Daily Menu Inventory.'
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
      });

      setSpecialRequest('');
      return;
    }

    if (allowedQuantity <= 0) {
      Alert.alert(
        'Sold Out',
        'This item is sold out for today.'
      );
      return;
    }

    if (!canAddMoreCurrentItem) {
      Alert.alert(
        'Limited Stock',
        `You can only order up to ${allowedQuantity} of this item today.`
      );
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

    if (
      !isValidDailyInventoryMenuItem(
        recommendedItem
      )
    ) {
      Alert.alert(
        'Unavailable',
        'This recommended item is not enabled in Daily Menu Inventory.'
      );
      return;
    }

    if (
      !isItemOrderable(
        recommendedItem
      )
    ) {
      Alert.alert(
        'Out of Stock',
        'This recommended item is currently out of stock.'
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
      !isCustomItem(recommendedItem) &&
      (
        allowedRecommendedQuantity <= 0 ||
        currentRecommendedQuantity >=
        allowedRecommendedQuantity
      )
    ) {
      Alert.alert(
        'Limited Stock',
        `You can only order up to ${allowedRecommendedQuantity} of this item today.`
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
    const enrichedItem =
      getEnrichedItem(cartItem);

    if (isCustomItem(enrichedItem)) {
      return;
    }

    if (
      !isValidDailyInventoryMenuItem(
        enrichedItem
      )
    ) {
      Alert.alert(
        'Unavailable',
        'This item is no longer enabled in Daily Menu Inventory.'
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
        `You can only order up to ${allowedCartQuantity} of this item today.`
      );

      return;
    }

    if (
      !canIncreaseQuantity(
        enrichedItem,
        cartItem.quantity,
        1
      )
    ) {
      Alert.alert(
        'Limited Stock',
        getAvailabilityDisplayText(
          enrichedItem
        ) ||
        'You reached the available quantity for this item.'
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

    const invalidDailyInventoryItems =
      cartItems.filter((cartItem) => {
        const enrichedItem =
          getEnrichedItem(cartItem);

        return (
          !isCustomItem(enrichedItem) &&
          !isValidDailyInventoryMenuItem(
            enrichedItem
          )
        );
      });

    if (
      invalidDailyInventoryItems.length > 0
    ) {
      Alert.alert(
        'Unavailable Item',
        'Some items in your cart are no longer enabled in Daily Menu Inventory. Please remove them before confirming your order.'
      );

      return;
    }

    const overLimitItems =
      cartItems.filter((cartItem) => {
        const enrichedItem =
          getEnrichedItem(cartItem);

        if (isCustomItem(enrichedItem)) {
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
        'Some items exceed the available quantity for today. Please adjust your cart before confirming your order.'
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
      isCustomItem(recommendedItem);

    const recommendedValid =
      isValidDailyInventoryMenuItem(
        recommendedItem
      );

    const recommendedAllowedQuantity =
      getAllowedOrderQuantity(
        recommendedItem
      );

    const recommendedAvailable =
      recommendedValid &&
      isItemOrderable(recommendedItem) &&
      (
        recommendedCustom ||
        recommendedAllowedQuantity > 0
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
            paddingHorizontal:
              responsive.recommendationCardPaddingH,
            paddingVertical:
              responsive.recommendationCardPaddingV,
            marginHorizontal:
              responsive.recommendationCardMarginH,
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
                marginRight:
                  responsive.recommendationCircleMarginRight,
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
                paddingVertical:
                  responsive.recommendationAddPaddingV,
                minWidth:
                  responsive.recommendationAddMinWidth,
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
                ? handleOpenRecommendedItem(recommendedItem)
                : handleAddRecommendedItem(recommendedItem)
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
      isCustomItem(enrichedItem);

    const validDailyInventoryItem =
      customCartItem ||
      isValidDailyInventoryMenuItem(
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
      !validDailyInventoryItem ||
      allowedCartQuantity <= 0 ||
      Number(cartItem.quantity || 0) >=
      allowedCartQuantity ||
      !canIncreaseQuantity(
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

            {!customCartItem &&
              allowedCartQuantity > 0 ? (
              <Text style={styles.cartLimitText}>
                Limit today: {allowedCartQuantity}
              </Text>
            ) : null}

            {!customCartItem &&
              !validDailyInventoryItem ? (
              <Text style={styles.cartInvalidText}>
                No longer available today
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
          barStyle="light-content"
          backgroundColor="#b8b3b3"
          translucent={false}
        />

        <SafeAreaView
          style={styles.safeArea}
          edges={['top']}
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
                  flex: 1,
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
                      minHeight:
                        responsive.detailCardMinHeight,
                      padding:
                        responsive.cardPadding,
                      borderRadius:
                        responsive.cardRadius,
                      justifyContent:
                        responsive.cardJustifyContent,
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
                        marginBottom:
                          responsive.imageMarginBottom,
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
                        marginTop:
                          responsive.priceMarginTop,
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
                        marginTop:
                          responsive.categoryMarginTop,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.category || 'Uncategorized'}
                  </Text>

                  {flavorTags.length > 0 ? (
                    <View
                      style={[
                        styles.flavorTagContainer,
                        {
                          marginTop:
                            responsive.tagMarginTop,
                        },
                      ]}
                    >
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
                    <Text
                      style={[
                        styles.mealTypeText,
                        {
                          marginTop:
                            responsive.categoryMarginTop,
                        },
                      ]}
                    >
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
                        marginTop:
                          responsive.stockMarginTop,
                      },
                    ]}
                  >
                    {!canOrder
                      ? 'Table not assigned'
                      : availabilityText}
                  </Text>

                  {!customItem &&
                    allowedQuantity > 0 ? (
                    <Text
                      style={[
                        styles.limitText,
                        {
                          fontSize:
                            responsive.limitText,
                          marginTop:
                            responsive.limitMarginTop,
                        },
                      ]}
                    >
                      Available to order today: {allowedQuantity}
                    </Text>
                  ) : null}

                  <Text
                    style={[
                      styles.description,
                      {
                        fontSize:
                          responsive.description,
                        lineHeight:
                          responsive.descriptionLine,
                        marginTop:
                          responsive.descriptionMarginTop,
                      },
                    ]}
                  >
                    {customItem
                      ? 'Price and availability will be confirmed by staff. QR PH is disabled for Chef Oppa Special requests.'
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
                        marginTop:
                          responsive.addButtonMarginTop,
                      },
                      (!isAvailable ||
                        !canOrder ||
                        !canAddMoreCurrentItem) &&
                      styles.addToOrderButtonDisabled,
                    ]}
                    disabled={
                      !isAvailable ||
                      !canOrder ||
                      !canAddMoreCurrentItem
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
                          ? currentCartQuantity >= 1
                            ? 'Request Already Added'
                            : 'Add Request to Cart'
                          : !isValidForMobile
                            ? 'Not Enabled Today'
                            : allowedQuantity <= 0
                              ? 'Sold Out Today'
                              : !canAddMoreCurrentItem
                                ? 'Limit Reached'
                                : 'Add to Order'}
                    </Text>
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.recommendationSection,
                      {
                        marginTop:
                          responsive.recommendationMarginTop,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.recommendationTitle,
                        {
                          fontSize:
                            responsive.recommendationTitle,
                          marginBottom:
                            responsive.recommendationTitleMarginBottom,
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
                    responsive.cartWidth,
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
                  Height:
                    responsive.useSideCart
                      ? undefined
                      : responsive.cartPhoneMinHeight,
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
                    String(getItemId(cartItem))
                  }
                  renderItem={renderCartItem}
                  horizontal={!responsive.useSideCart}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  style={[
                    styles.cartList,
                    !responsive.useSideCart && {
                      maxHeight:
                        responsive.cartPhoneListMaxHeight,
                      minHeight: 40,
                    },
                  ]}
                  contentContainerStyle={{
                    paddingBottom:
                      responsive.useSideCart
                        ? 12
                        : 4,
                    gap:
                      responsive.useSideCart
                        ? 0
                        : 12,
                  }}
                />
              )}

              <View
                style={[
                  styles.cartFooter,
                  {
                    paddingBottom:
                      responsive.useSideCart
                        ? 10
                        : 4,
                  },
                ]}
              >
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
                    Chef Oppa Special requests require staff confirmation for final price and availability. QR PH is disabled when a custom request is included.
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
      backgroundColor: '#fff',
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

    limitText: {
      marginTop: 6,
      color: '#666',
      fontWeight: '900',
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
      paddingVertical: 10,
      marginHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
    },

    recommendationCardDisabled: {
      opacity: 0.45,
    },

    recommendationLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      paddingRight: 12,
      minWidth: 0,
    },

    recommendationCircle: {
      backgroundColor: '#ffe1ca',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      marginRight: 12,
      flexShrink: 0,
    },

    recommendationImage: {
      width: '100%',
      height: '100%',
    },

    recommendationEmoji: {
      fontSize: 30,
    },

    recommendationTextBox: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },

    recommendationName: {
      width: '100%',
      fontWeight: '900',
      color: '#333',
    },

    recommendationRight: {
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },

    recommendationPrice: {
      width: '100%',
      fontWeight: '900',
      color: '#f68c45',
      marginTop: 3,
      textAlign: 'left',
    },

    recommendationAddButton: {
      backgroundColor: '#f68c45',
      paddingVertical: 7,
      borderRadius: 10,
      minWidth: 74,
      alignItems: 'center',
    },

    recommendationAddButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    recommendationAddText: {
      color: '#fff',
      fontWeight: '900',
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
      flexShrink: 0,
    },

    cartList: {
      flexGrow: 0,
      minHeight: 62,
    },

    cartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
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
      marginTop: 2,
      borderBottomWidth: 1,
      borderBottomColor: '#dddddd',
      paddingBottom: 6,
    },

    cartItem: {
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#eeeeee',
    },

    cartItemStacked: {
      minWidth: 150,
      maxWidth: 210,
      paddingRight: 8,
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
      marginTop: 3,
    },

    cartLimitText: {
      marginTop: 3,
      color: '#666',
      fontSize: 11,
      fontWeight: '900',
    },

    cartInvalidText: {
      marginTop: 3,
      color: '#b00020',
      fontSize: 11,
      fontWeight: '900',
    },

    cartRequestText: {
      marginTop: 4,
      color: '#666',
      fontWeight: '700',
      lineHeight: 18,
    },

    customQtyBox: {
      marginTop: 8,
      alignSelf: 'flex-start',
      backgroundColor: '#fff4eb',
      borderWidth: 1,
      borderColor: '#f0b287',
      borderRadius: 10,
      paddingVertical: 5,
      paddingHorizontal: 9,
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
      paddingVertical: 7,
      paddingHorizontal: 9,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 17,
      marginBottom: 7,
    },

    removeText: {
      fontWeight: '800',
      color: '#999',
    },

    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
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
      marginHorizontal: 10,
    },

    cartFooter: {
      borderTopWidth: 1,
      borderTopColor: '#dddddd',
      paddingTop: 6,
    },

    totalRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 7,
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