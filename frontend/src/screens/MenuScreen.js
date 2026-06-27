import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
  Modal,
  useWindowDimensions,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  useFocusEffect,
  CommonActions,
} from '@react-navigation/native';

import { getMenu } from '../api/dinesync';

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

const ASSIGNED_TABLE_STATUSES = [
  'seated',
  'occupied',
  'assigned',
  'in_use',
  'active',
];

const VALID_NORMAL_INVENTORY_TYPES = [
  'per_order',
  'per_head',
];

const excludedPopularCategories = [
  'Drinks',
  'Drink',
  'Extras',
  'Extra',
  'Beverage',
  'Beverages',
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

const isExcludedPopularCategory = (item) => {
  const category =
    normalizeText(item?.category);

  const mealType =
    normalizeText(item?.meal_type);

  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  const name =
    normalizeText(item?.name);

  const excluded =
    excludedPopularCategories
      .map(normalizeText);

  return (
    excluded.includes(category) ||
    excluded.includes(mealType) ||
    mealType === 'drink' ||
    mealType === 'drinks' ||
    mealType === 'extra' ||
    mealType === 'extras' ||
    inventoryType === 'drink' ||
    inventoryType === 'drinks' ||
    inventoryType === 'extra' ||
    inventoryType === 'extras' ||
    category.includes('drink') ||
    category.includes('beverage') ||
    category.includes('extra') ||
    name.includes('water')
  );
};

const hasValidActiveSession = (sessionId) => {
  return (
    sessionId !== null &&
    sessionId !== undefined &&
    String(sessionId).trim() !== ''
  );
};

const normalizeTableStatus = (status) => {
  return String(status || '')
    .trim()
    .toLowerCase();
};

const isStaffAssignedStatus = (status) => {
  return ASSIGNED_TABLE_STATUSES.includes(
    normalizeTableStatus(status)
  );
};

const getStrictOrderPermission = (
  latestStatus,
  providerCanOrder
) => {
  const hasActiveSession =
    hasValidActiveSession(
      latestStatus?.active_session_id
    );

  const tableIsAssignedByStaff =
    isStaffAssignedStatus(
      latestStatus?.table_status
    );

  return (
    providerCanOrder === true &&
    hasActiveSession &&
    tableIsAssignedByStaff
  );
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

export default function MenuScreen({
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

      const isLandscape =
        width > height;

      const isPhone =
        shortest < 600;

      const isPhoneWidth =
        width < 430;

      const isVeryNarrow =
        width < 380;

      const isShortHeight =
        height < 650;

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

      const useSideCart =
        isLandscape &&
        width >= 760 &&
        height >= 520;

      const cartWidth =
        useSideCart
          ? clamp(width * 0.27, 250, 370)
          : '100%';

      const availableMenuWidth =
        useSideCart
          ? width - cartWidth
          : width;

      const menuPaddingH =
        isPhoneWidth
          ? scale(12, 10, 14)
          : scale(18, 12, 24);

      const cardGap =
        isPhoneWidth
          ? scale(12, 10, 14)
          : scale(20, 16, 24);

      const menuColumns =
        useSideCart
          ? clamp(
            Math.floor(
              availableMenuWidth / 215
            ),
            2,
            3
          )
          : 2;

      const menuCardWidth =
        Math.floor(
          (
            availableMenuWidth -
            menuPaddingH * 2 -
            cardGap * (menuColumns - 1)
          ) / menuColumns
        );

      const finalImageSize =
        isPhoneWidth
          ? scale(64, 54, 70)
          : menuColumns > 1 && !useSideCart
            ? scale(88, 66, 94)
            : scale(102, 74, 110);

      const stackedCartMinHeight =
        clamp(
          height * 0.21,
          isVeryNarrow ? 185 : 205,
          255
        );

      const stackedCartMaxHeight =
        clamp(
          height * 0.26,
          isVeryNarrow ? 205 : 230,
          300
        );

      const stackedCartListMaxHeight =
        clamp(
          height * 0.12,
          86,
          125
        );

      return {
        isPhone,
        isPhoneWidth,
        isVeryNarrow,
        isShortHeight,
        useSideCart,
        cartWidth,
        menuColumns,
        menuCardWidth,
        stackedCartMinHeight,
        stackedCartMaxHeight,
        stackedCartListMaxHeight,
        cardGap,

        topSafeExtra: 0,

        topBarMinHeight:
          isPhoneWidth
            ? scale(78, 70, 84)
            : scale(74, 62, 82),

        topBarPaddingH:
          isPhoneWidth
            ? scale(12, 10, 14)
            : scale(18, 12, 24),

        topBarPaddingV:
          isPhoneWidth
            ? scale(7, 5, 8)
            : scale(8, 6, 10),

        topTitle:
          isPhoneWidth
            ? scale(21, 17, 22)
            : scale(28, 20, 28),

        topSubtitle:
          scale(13, 10, 13),

        tableText:
          isPhoneWidth
            ? scale(14, 11, 14)
            : scale(20, 12, 20),

        topButtonFont:
          isPhoneWidth
            ? scale(11, 9, 12)
            : scale(15, 10, 15),

        topButtonPaddingV:
          isPhoneWidth
            ? scale(5, 4, 6)
            : scale(8, 5, 8),

        topButtonPaddingH:
          isPhoneWidth
            ? scale(8, 6, 10)
            : scale(14, 7, 14),

        categoryHeight:
          isPhoneWidth
            ? scale(54, 48, 58)
            : scale(66, 50, 68),

        categoryPaddingV:
          isPhoneWidth
            ? scale(10, 7, 10)
            : scale(12, 8, 12),

        categoryPaddingH:
          isPhoneWidth
            ? scale(16, 12, 18)
            : scale(22, 12, 22),

        categoryText:
          scale(18, 12, 18),

        bannerText:
          scale(16, 12, 16),

        menuPaddingTop:
          isPhoneWidth
            ? scale(12, 10, 14)
            : scale(18, 14, 22),

        menuPaddingH,

        itemMinHeight:
          isPhoneWidth
            ? scale(178, 160, 188)
            : menuColumns > 1 && !useSideCart
              ? scale(220, 195, 235)
              : scale(235, 205, 245),

        itemPadding:
          isPhoneWidth
            ? scale(9, 7, 10)
            : scale(13, 10, 15),

        itemRadius:
          scale(18, 14, 18),

        imageSize:
          finalImageSize,

        imageRadius:
          finalImageSize / 2,

        itemName:
          isPhoneWidth
            ? scale(14, 12, 15)
            : menuColumns > 1 && !useSideCart
              ? scale(18, 13, 18)
              : scale(21, 16, 21),

        itemCategory:
          isPhoneWidth
            ? scale(10, 8, 11)
            : scale(12, 9, 12),

        itemPrice:
          isPhoneWidth
            ? scale(15, 12, 16)
            : scale(18, 13, 18),

        stockText:
          isPhoneWidth
            ? scale(12, 10, 13)
            : scale(15, 10, 15),

        tapText:
          isPhoneWidth
            ? scale(11, 9, 12)
            : scale(13, 10, 13),

        badgeText:
          isPhoneWidth
            ? scale(9, 8, 10)
            : scale(12, 9, 12),

        customBadgeText:
          isPhoneWidth
            ? scale(8, 7, 9)
            : scale(11, 8, 11),

        sidebarPaddingH:
          scale(14, 8, 16),

        sidebarPaddingT:
          useSideCart
            ? scale(12, 7, 16)
            : scale(7, 5, 9),

        sidebarPaddingBottom:
          useSideCart
            ? Math.max(insets.bottom + 8, 12)
            : Math.max(insets.bottom + 2, 6),

        cartIcon:
          scale(24, 17, 24),

        cartTitle:
          scale(22, 15, 22),

        cartItemName:
          scale(15, 11, 15),

        cartItemPrice:
          scale(14, 11, 14),

        cartRequest:
          scale(13, 10, 13),

        removeText:
          scale(24, 17, 24),

        qtyButton:
          scale(30, 22, 32),

        qtyButtonText:
          scale(18, 13, 18),

        qtyText:
          scale(16, 12, 16),

        totalLabel:
          scale(18, 13, 18),

        totalValue:
          scale(22, 16, 22),

        checkoutText:
          scale(16, 12, 16),

        checkoutPadding:
          isPhoneWidth
            ? scale(10, 7, 10)
            : scale(12, 8, 12),

        searchPadding:
          isPhoneWidth
            ? scale(8, 6, 10)
            : scale(12, 9, 14),

        searchBottomPadding:
          Math.max(insets.bottom + 4, 10),

        searchFont:
          scale(18, 12, 18),

        searchButtonText:
          scale(18, 12, 18),

        searchButtonPaddingV:
          scale(10, 7, 11),

        searchButtonPaddingH:
          isPhoneWidth
            ? scale(14, 10, 16)
            : scale(24, 12, 24),

        modalWidth:
          clamp(width * 0.86, 300, 420),

        modalTitle:
          scale(28, 20, 28),

        modalText:
          scale(16, 12, 16),

        modalInput:
          scale(17, 13, 17),

        modalButton:
          scale(16, 13, 16),
      };
    }, [
      width,
      height,
      insets.bottom,
    ]);

  const [menuItems, setMenuItems] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState('');

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState('All');

  const [
    logoutModalVisible,
    setLogoutModalVisible,
  ] = useState(false);

  const [
    logoutPassword,
    setLogoutPassword,
  ] = useState('');

  const {
    user,
    tableNumber,
    logout,
  } = useAuth();

  const {
    cartItems,
    updateQuantity,
    incrementQuantity,
    removeFromCart,
    cartTotal,
    syncMenuInventory,
    refreshCartInventory,
    getEnrichedItem,
  } = useCart();

  const {
    canOrder,
    tableStatus,
    ensureCanOrder,
    refreshTableStatus,
    assignmentMessage,
    tableResetRequired,
    acknowledgeTableReset,
  } = useTableStatus();

  const strictCanOrder =
    getStrictOrderPermission(
      tableStatus,
      canOrder
    );

  const strictAssignmentMessage =
    assignmentMessage ||
    'Please wait for service staff to assign your table before placing an order.';

  useEffect(() => {
    fetchMenu();

    const refreshTimer =
      setInterval(() => {
        fetchMenu();
      }, 15000);

    return () =>
      clearInterval(refreshTimer);
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => true;

      const subscription =
        BackHandler.addEventListener(
          'hardwareBackPress',
          onBackPress
        );

      return () =>
        subscription.remove();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      fetchMenu();
      refreshTableStatus();
    }, [refreshTableStatus])
  );

  const fetchMenu = async () => {
    try {
      const response =
        await getMenu();

      console.log(
        'MENU RESPONSE:',
        response
      );

      if (response.success) {
        const rawItems =
          response.data || [];

        const visibleItems =
          rawItems.filter(
            isValidDailyInventoryMenuItem
          );

        console.log(
          'MOBILE MENU FILTER:',
          {
            raw_count:
              rawItems.length,
            visible_count:
              visibleItems.length,
          }
        );

        setMenuItems(
          visibleItems
        );

        syncMenuInventory(
          visibleItems
        );
      } else {
        Alert.alert(
          'Error',
          response.message ||
          'Failed to fetch menu.'
        );
      }
    } catch (error) {
      console.error(
        'Failed to fetch menu:',
        error?.response?.data ||
        error.message
      );

      Alert.alert(
        'Error',
        'Failed to fetch menu.'
      );
    } finally {
      setLoading(false);
    }
  };

  const openLogoutModal = () => {
    setLogoutPassword('');
    setLogoutModalVisible(true);
  };

  const closeLogoutModal = () => {
    setLogoutPassword('');
    setLogoutModalVisible(false);
  };

  const handleConfirmLogout = async () => {
    const result =
      await logout(logoutPassword);

    if (!result.success) {
      Alert.alert(
        'Logout Failed',
        result.message ||
        'Unable to logout.'
      );

      return;
    }

    closeLogoutModal();

    navigation.replace('Login');
  };

  const formatMoney = (value) => {
    const n = Number(value);

    return Number.isFinite(n)
      ? n.toFixed(2)
      : '0.00';
  };

  const getItemImage = (item) => {
    const image =
      item?.image_url
        ? String(item.image_url).trim()
        : item?.image
          ? String(item.image).trim()
          : '';

    return image;
  };

  const isBestSeller = (item) => {
    if (isExcludedPopularCategory(item)) {
      return false;
    }

    return (
      item.is_best_seller === true ||
      item.is_best_seller === 1 ||
      item.is_best_seller === 'true' ||
      item.is_best_seller === '1'
    );
  };

  const checkLatestTablePermission =
    async () => {
      const latestStatus =
        await refreshTableStatus();

      const tableCheck =
        await ensureCanOrder();

      const allowed =
        tableCheck?.allowed === true &&
        getStrictOrderPermission(
          latestStatus,
          true
        );

      return {
        allowed,
        message:
          tableCheck?.message ||
          strictAssignmentMessage,
      };
    };

  const handleOpenItem = async (item) => {
    const tableCheck =
      await checkLatestTablePermission();

    if (!tableCheck?.allowed) {
      Alert.alert(
        'Table Not Assigned',
        tableCheck?.message ||
        strictAssignmentMessage
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

    if (!isItemOrderable(item)) {
      Alert.alert(
        'Unavailable',
        getAvailabilityDisplayText(item) ||
        'This item is currently unavailable.'
      );

      return;
    }

    navigation.navigate(
      'ItemDetail',
      { item }
    );
  };

  const handleIncreaseQuantity = (
    item
  ) => {
    const enrichedItem =
      getEnrichedItem(item);

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

    if (
      !canIncreaseQuantity(
        enrichedItem,
        item.quantity,
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
      getItemId(item)
    );
  };

  const handleDecreaseQuantity = (
    item
  ) => {
    const itemId =
      getItemId(item);

    updateQuantity(
      itemId,
      item.quantity - 1
    );
  };

  const handleRemoveFromCart = (
    item
  ) => {
    const itemId =
      getItemId(item);

    removeFromCart(itemId);
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
      await checkLatestTablePermission();

    if (!tableCheck?.allowed) {
      Alert.alert(
        'Table Not Assigned',
        tableCheck?.message ||
        strictAssignmentMessage
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

    if (!tableNumber && !user?.table_number) {
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
        tableNumber:
          tableNumber ||
          user?.table_number,
      }
    );
  };

  const categories = [
    'All',
    ...new Set(
      menuItems
        .filter(
          isValidDailyInventoryMenuItem
        )
        .map((m) => m.category)
        .filter(Boolean)
    ),
  ];

  const filteredItems =
    menuItems
      .filter(
        isValidDailyInventoryMenuItem
      )
      .filter((item) => {
        const byCategory =
          selectedCategory === 'All' ||
          item.category === selectedCategory;

        const bySearch =
          !search ||
          (item.name || '')
            .toLowerCase()
            .includes(
              search.toLowerCase()
            );

        return byCategory && bySearch;
      })
      .sort((a, b) => {
        const aPopular =
          isBestSeller(a);

        const bPopular =
          isBestSeller(b);

        const aAvailable =
          isItemOrderable(a);

        const bAvailable =
          isItemOrderable(b);

        if (aPopular !== bPopular) {
          return Number(bPopular) -
            Number(aPopular);
        }

        if (aAvailable !== bAvailable) {
          return Number(bAvailable) -
            Number(aAvailable);
        }

        return String(
          a.name || ''
        ).localeCompare(
          String(b.name || '')
        );
      });

  const totalQuantity =
    cartItems.reduce(
      (total, item) =>
        total +
        Number(item.quantity || 0),
      0
    );

  const hasCustomRequest =
    cartItems.some(isCustomItem);

  const renderMenuItem = ({
    item,
  }) => {
    const imageUri =
      getItemImage(item);

    const customItem =
      isCustomItem(item);

    const isValidForMobile =
      isValidDailyInventoryMenuItem(item);

    const isAvailable =
      isValidForMobile &&
      isItemOrderable(item);

    const isLowStock =
      shouldShowLowStockWarning(item);

    const availabilityText =
      customItem
        ? 'Custom request available'
        : getAvailabilityDisplayText(item);

    const bestSeller =
      isBestSeller(item);

    const disabled =
      !isAvailable || !strictCanOrder;

    return (
      <TouchableOpacity
        style={[
          styles.menuItem,
          {
            width:
              responsive.menuCardWidth,
            minHeight:
              responsive.itemMinHeight,
            padding:
              responsive.itemPadding,
            borderRadius:
              responsive.itemRadius,
            marginBottom:
              responsive.cardGap,
          },
          disabled &&
          styles.unavailableItem,
          customItem &&
          styles.customMenuItem,
        ]}
        disabled={disabled}
        onPress={() =>
          handleOpenItem(item)
        }
      >
        {bestSeller ? (
          <View style={styles.bestSellerBadge}>
            <Text
              style={[
                styles.bestSellerBadgeText,
                {
                  fontSize:
                    responsive.badgeText,
                },
              ]}
            >
              🔥 Popular
            </Text>
          </View>
        ) : null}

        {customItem ? (
          <View style={styles.customBadge}>
            <Text
              style={[
                styles.customBadgeText,
                {
                  fontSize:
                    responsive.customBadgeText,
                },
              ]}
            >
              Chef Oppa Special
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.itemImageCircle,
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
          <Image
            source={
              imageUri
                ? { uri: imageUri }
                : require('../../assets/placeholder-food.png')
            }
            style={styles.itemImage}
            resizeMode="cover"
          />
        </View>

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
            {item.name}
          </Text>

          <Text
            style={[
              styles.itemCategoryText,
              {
                fontSize:
                  responsive.itemCategory,
              },
            ]}
            numberOfLines={1}
          >
            {item.category || 'Uncategorized'}
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
            numberOfLines={1}
          >
            {customItem
              ? 'To be confirmed'
              : `₱${formatMoney(item.price)}`}
          </Text>

          <Text
            style={[
              !strictCanOrder
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
            numberOfLines={2}
          >
            {!strictCanOrder
              ? 'Table not assigned'
              : availabilityText}
          </Text>

          <Text
            style={[
              styles.tapText,
              {
                fontSize:
                  responsive.tapText,
              },
            ]}
          >
            {strictCanOrder
              ? 'Tap to view'
              : 'Waiting for staff'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCartItem = ({
    item,
  }) => {
    const enrichedItem =
      getEnrichedItem(item);

    const customCartItem =
      isCustomItem(enrichedItem);

    const validDailyInventoryItem =
      customCartItem ||
      isValidDailyInventoryMenuItem(
        enrichedItem
      );

    const atMaxQuantity =
      customCartItem ||
        !validDailyInventoryItem
        ? true
        : !canIncreaseQuantity(
          enrichedItem,
          item.quantity,
          1
        );

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
              {item.name}
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
                : `₱${formatMoney(item.price)}`}
            </Text>

            {!customCartItem &&
              !validDailyInventoryItem ? (
              <Text style={styles.cartInvalidText}>
                No longer available today
              </Text>
            ) : null}

            {customCartItem &&
              item.special_request ? (
              <Text
                style={[
                  styles.cartRequestText,
                  {
                    fontSize:
                      responsive.cartRequest,
                  },
                ]}
              >
                Request: {item.special_request}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={() =>
              handleRemoveFromCart(
                item
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
                  item
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
              {item.quantity}
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
                    item
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

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color="#f68c45"
        />
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
                  responsive.topBarMinHeight,
                paddingHorizontal:
                  responsive.topBarPaddingH,
                paddingVertical:
                  responsive.topBarPaddingV,
              },
            ]}
          >
            <View style={styles.brandBox}>
              <Text
                style={[
                  styles.topBarText,
                  {
                    fontSize:
                      responsive.topTitle,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                DineSync+
              </Text>

              <Text
                style={[
                  styles.topBarSubText,
                  {
                    fontSize:
                      responsive.topSubtitle,
                  },
                ]}
                numberOfLines={1}
              >
                Customer Menu
              </Text>
            </View>

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
                Table {tableNumber || user?.table_number || '-'}
              </Text>

              <TouchableOpacity
                style={[
                  styles.historyButton,
                  {
                    paddingVertical:
                      responsive.topButtonPaddingV,
                    paddingHorizontal:
                      responsive.topButtonPaddingH,
                  },
                ]}
                onPress={() =>
                  navigation.navigate(
                    'OrderHistory'
                  )
                }
              >
                <Text
                  style={[
                    styles.historyButtonText,
                    {
                      fontSize:
                        responsive.topButtonFont,
                    },
                  ]}
                  numberOfLines={1}
                >
                  Order History
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusButton,
                  {
                    paddingVertical:
                      responsive.topButtonPaddingV,
                    paddingHorizontal:
                      responsive.topButtonPaddingH,
                  },
                ]}
                onPress={() =>
                  navigation.navigate(
                    'OrderStatus'
                  )
                }
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    {
                      fontSize:
                        responsive.topButtonFont,
                    },
                  ]}
                  numberOfLines={1}
                >
                  View Order Status
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.logoutButton,
                  {
                    paddingVertical:
                      responsive.topButtonPaddingV,
                    paddingHorizontal:
                      responsive.topButtonPaddingH,
                  },
                ]}
                onPress={openLogoutModal}
              >
                <Text
                  style={[
                    styles.logoutButtonText,
                    {
                      fontSize:
                        responsive.topButtonFont,
                    },
                  ]}
                  numberOfLines={1}
                >
                  Staff Logout
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            horizontal
            data={categories}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            style={[
              styles.categoryBar,
              {
                maxHeight:
                  responsive.categoryHeight,
              },
            ]}
            contentContainerStyle={{
              paddingHorizontal: 10,
              alignItems: 'center',
            }}
            renderItem={({
              item: category,
            }) => (
              <TouchableOpacity
                style={[
                  styles.categoryBtn,
                  {
                    paddingVertical:
                      responsive.categoryPaddingV,
                    paddingHorizontal:
                      responsive.categoryPaddingH,
                  },
                  selectedCategory === category &&
                  styles.categoryBtnActive,
                ]}
                onPress={() =>
                  setSelectedCategory(category)
                }
              >
                <Text
                  style={[
                    styles.categoryText,
                    {
                      fontSize:
                        responsive.categoryText,
                    },
                    selectedCategory === category &&
                    styles.categoryTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            )}
          />

          {!strictCanOrder ? (
            <View style={styles.assignmentBanner}>
              <Text
                style={[
                  styles.assignmentBannerText,
                  {
                    fontSize:
                      responsive.bannerText,
                  },
                ]}
              >
                {strictAssignmentMessage}
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
                styles.menuSection,
                {
                  paddingTop:
                    responsive.menuPaddingTop,
                  paddingHorizontal:
                    responsive.menuPaddingH,
                },
              ]}
            >
              <FlatList
                key={`menu-${responsive.menuColumns}-${responsive.useSideCart ? 'side' : 'stack'}`}
                data={filteredItems}
                renderItem={renderMenuItem}
                numColumns={responsive.menuColumns}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(
                  item,
                  index
                ) =>
                  String(
                    getItemId(item) ||
                    index
                  )
                }
                columnWrapperStyle={
                  responsive.menuColumns > 1
                    ? {
                      justifyContent:
                        'center',
                      gap:
                        responsive.cardGap,
                    }
                    : undefined
                }
                contentContainerStyle={{
                  paddingTop: 2,
                  paddingBottom:
                    responsive.useSideCart
                      ? 30
                      : responsive.cardGap + 12,
                  alignItems:
                    responsive.menuColumns === 1
                      ? 'center'
                      : undefined,
                }}
                ListEmptyComponent={() => (
                  <View style={styles.emptyMenuBox}>
                    <Text style={styles.emptyMenuTitle}>
                      No available menu items
                    </Text>

                    <Text style={styles.emptyMenuText}>
                      Menu items must be enabled in Daily Menu Inventory before they appear here.
                    </Text>
                  </View>
                )}
              />
            </View>

            <View
              style={[
                styles.cartSidebar,
                {
                  width:
                    responsive.useSideCart
                      ? responsive.cartWidth
                      : '100%',
                  minHeight:
                    responsive.useSideCart
                      ? undefined
                      : responsive.stackedCartMinHeight,
                  maxHeight:
                    responsive.useSideCart
                      ? undefined
                      : responsive.stackedCartMaxHeight,
                  paddingHorizontal:
                    responsive.sidebarPaddingH,
                  paddingTop:
                    responsive.sidebarPaddingT,
                  paddingBottom:
                    responsive.sidebarPaddingBottom,
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
                  keyExtractor={(item) =>
                    String(getItemId(item))
                  }
                  renderItem={renderCartItem}
                  horizontal={
                    !responsive.useSideCart
                  }
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  style={[
                    styles.cartList,
                    !responsive.useSideCart && {
                      maxHeight:
                        responsive.stackedCartListMaxHeight,
                      minHeight: 82,
                    },
                  ]}
                  contentContainerStyle={{
                    paddingBottom:
                      responsive.useSideCart
                        ? 14
                        : 4,
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

                {hasCustomRequest ? (
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
                      !strictCanOrder) &&
                    styles.checkoutButtonDisabled,
                  ]}
                  disabled={
                    cartItems.length === 0 ||
                    !strictCanOrder
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

          <View
            style={[
              styles.searchBar,
              {
                padding:
                  responsive.searchPadding,
                paddingBottom:
                  responsive.searchBottomPadding,
              },
            ]}
          >
            <TextInput
              placeholder="Search menu"
              value={search}
              onChangeText={setSearch}
              style={[
                styles.searchInput,
                {
                  fontSize:
                    responsive.searchFont,
                },
              ]}
              placeholderTextColor="#999"
            />

            <TouchableOpacity
              style={[
                styles.searchButton,
                {
                  paddingVertical:
                    responsive.searchButtonPaddingV,
                  paddingHorizontal:
                    responsive.searchButtonPaddingH,
                },
              ]}
              onPress={() => { }}
            >
              <Text
                style={[
                  styles.searchButtonText,
                  {
                    fontSize:
                      responsive.searchButtonText,
                  },
                ]}
                numberOfLines={1}
              >
                Search
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <Modal
        transparent
        visible={logoutModalVisible}
        animationType="fade"
        onRequestClose={closeLogoutModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.logoutModal,
                {
                  width:
                    responsive.modalWidth,
                },
              ]}
            >
              <Text
                style={[
                  styles.modalTitle,
                  {
                    fontSize:
                      responsive.modalTitle,
                  },
                ]}
              >
                Staff Logout
              </Text>

              <Text
                style={[
                  styles.modalText,
                  {
                    fontSize:
                      responsive.modalText,
                  },
                ]}
              >
                Enter staff password to logout this tablet.
              </Text>

              <TextInput
                style={[
                  styles.passwordInput,
                  {
                    fontSize:
                      responsive.modalInput,
                  },
                ]}
                value={logoutPassword}
                onChangeText={setLogoutPassword}
                placeholder="Enter password"
                secureTextEntry
                autoCapitalize="none"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={closeLogoutModal}
                >
                  <Text
                    style={[
                      styles.cancelButtonText,
                      {
                        fontSize:
                          responsive.modalButton,
                      },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirmLogout}
                >
                  <Text
                    style={[
                      styles.confirmButtonText,
                      {
                        fontSize:
                          responsive.modalButton,
                      },
                    ]}
                  >
                    Logout
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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

    loadingScreen: {
      flex: 1,
      backgroundColor: '#efefef',
      justifyContent: 'center',
      alignItems: 'center',
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
      gap: 8,
      flexWrap: 'wrap',
    },

    brandBox: {
      flexShrink: 1,
      minWidth: 92,
      maxWidth: 145,
    },

    topBarText: {
      color: '#fff',
      fontWeight: '900',
    },

    topBarSubText: {
      color: '#f7f7f7',
      fontWeight: '700',
      marginTop: 1,
    },

    topIcons: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 6,
      minWidth: 220,
    },

    tableText: {
      color: '#fff',
      fontWeight: '900',
    },

    historyButton: {
      backgroundColor: '#fff',
      borderRadius: 12,
    },

    historyButtonText: {
      color: '#f68c45',
      fontWeight: '900',
    },

    statusButton: {
      backgroundColor: '#f68c45',
      borderRadius: 12,
    },

    statusButtonText: {
      color: '#fff',
      fontWeight: '800',
    },

    logoutButton: {
      backgroundColor: '#333',
      borderRadius: 12,
    },

    logoutButtonText: {
      color: '#fff',
      fontWeight: '800',
    },

    categoryBar: {
      backgroundColor: '#f7f7f7',
      borderBottomWidth: 1,
      borderColor: '#e3e3e3',
    },

    categoryBtn: {
      borderRadius: 24,
      backgroundColor: '#ececec',
      marginRight: 10,
    },

    categoryBtnActive: {
      backgroundColor: '#f68c45',
    },

    categoryText: {
      fontWeight: '700',
      color: '#333',
    },

    categoryTextActive: {
      color: '#fff',
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
    },

    assignmentBannerText: {
      color: '#8a4b12',
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 22,
    },

    contentArea: {
      flex: 1,
    },

    menuSection: {
      flex: 1,
    },

    menuItem: {
      backgroundColor: '#fff',
      borderWidth: 1.5,
      borderColor: '#f0b287',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },

    customMenuItem: {
      borderColor: '#f68c45',
      backgroundColor: '#fffaf5',
    },

    unavailableItem: {
      opacity: 0.45,
    },

    bestSellerBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      backgroundColor: '#fff4eb',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 999,
      paddingVertical: 3,
      paddingHorizontal: 6,
      zIndex: 10,
    },

    bestSellerBadgeText: {
      color: '#f68c45',
      fontWeight: '900',
    },

    customBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: '#f68c45',
      borderRadius: 999,
      paddingVertical: 3,
      paddingHorizontal: 6,
      zIndex: 10,
    },

    customBadgeText: {
      color: '#fff',
      fontWeight: '900',
    },

    itemImageCircle: {
      backgroundColor: '#ececec',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      marginTop: 8,
    },

    itemImage: {
      width: '100%',
      height: '100%',
    },

    itemInfo: {
      alignItems: 'center',
      marginTop: 8,
      width: '100%',
    },

    itemName: {
      fontWeight: '800',
      textAlign: 'center',
      marginTop: 6,
      color: '#222',
    },

    itemCategoryText: {
      marginTop: 3,
      color: '#999',
      fontWeight: '800',
      textAlign: 'center',
    },

    itemPrice: {
      color: '#777',
      marginTop: 5,
      fontWeight: '700',
      textAlign: 'center',
    },

    customPrice: {
      color: '#f68c45',
      fontWeight: '900',
    },

    availableText: {
      color: '#4CAF50',
      fontWeight: '700',
      marginTop: 6,
      textAlign: 'center',
    },

    notAvailableText: {
      color: 'red',
      fontWeight: '700',
      marginTop: 6,
      textAlign: 'center',
    },

    lowStockText: {
      color: '#e67e22',
      fontWeight: '700',
      marginTop: 6,
      textAlign: 'center',
    },

    tapText: {
      marginTop: 6,
      color: '#999',
      fontWeight: '700',
    },

    emptyMenuBox: {
      minHeight: 220,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 30,
    },

    emptyMenuTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
      marginBottom: 8,
    },

    emptyMenuText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#777',
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 420,
    },

    cartSidebar: {
      backgroundColor: '#fff',
      borderLeftColor: '#ddd',
      borderTopColor: '#ddd',
      flexShrink: 0,
    },

    cartList: {
      flexGrow: 0,
      minHeight: 72,
    },

    cartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
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
      marginTop: 4,
      borderBottomWidth: 1,
      borderBottomColor: '#dddddd',
      paddingBottom: 8,
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
      fontWeight: '800',
      color: '#222',
    },

    cartItemPrice: {
      fontWeight: '700',
      color: '#f68c45',
      marginTop: 4,
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

    removeText: {
      fontWeight: '800',
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
      fontWeight: '800',
    },

    qtyText: {
      fontWeight: '800',
      marginHorizontal: 12,
    },

    cartFooter: {
      borderTopWidth: 1,
      borderTopColor: '#dddddd',
      paddingTop: 8,
      paddingBottom: 4,
    },

    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
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

    searchBar: {
      borderTopWidth: 1,
      borderColor: '#ddd',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#fafafa',
      gap: 10,
    },

    searchInput: {
      flex: 1,
      maxWidth: 760,
      backgroundColor: '#fff',
      borderRadius: 28,
      borderWidth: 1,
      borderColor: '#ddd',
      paddingHorizontal: 18,
      paddingVertical: 10,
      color: '#222',
    },

    searchButton: {
      backgroundColor: '#f68c45',
      borderRadius: 12,
    },

    searchButtonText: {
      color: '#fff',
      fontWeight: '700',
    },

    modalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0, 0, 0, 0.55)',
    },

    modalScrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },

    logoutModal: {
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: 24,
    },

    modalTitle: {
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
      marginBottom: 8,
    },

    modalText: {
      color: '#666',
      textAlign: 'center',
      marginBottom: 18,
      lineHeight: 22,
    },

    passwordInput: {
      backgroundColor: '#f7f7f7',
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 20,
    },

    modalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },

    cancelButton: {
      flex: 1,
      backgroundColor: '#ddd',
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: 'center',
      marginRight: 8,
    },

    cancelButtonText: {
      color: '#333',
      fontWeight: '800',
    },

    confirmButton: {
      flex: 1,
      backgroundColor: '#f68c45',
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: 'center',
      marginLeft: 8,
    },

    confirmButtonText: {
      color: '#fff',
      fontWeight: '800',
    },
  });