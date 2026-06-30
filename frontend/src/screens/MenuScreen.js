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
  isCustomItem,
} from '../utils/inventory';

const EXPECTED_MENU_DEBUG_SOURCE =
  'WEB_MENU_INGREDIENT_AVAILABILITY_FIXED_2026';

const ASSIGNED_TABLE_STATUSES = [
  'seated',
  'occupied',
  'assigned',
  'in_use',
  'active',
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

const toNumber = (value) => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
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

const getRemainingQuantity = (item) => {
  return toNumber(
    item?.remaining_today ??
      item?.available_quantity ??
      item?.max_order_quantity
  );
};

const getMaxOrderQuantity = (item) => {
  return toNumber(
    item?.max_order_quantity ??
      item?.remaining_today ??
      item?.available_quantity
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
    excludedPopularCategories.map(
      normalizeText
    );

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

const isMenuItemAvailableByBackend = (item) => {
  if (isCustomItem(item)) {
    return isBackendAvailableTrue(
      item?.is_available
    );
  }

  const maxOrderQuantity =
    getMaxOrderQuantity(item);

  const remainingQuantity =
    getRemainingQuantity(item);

  return (
    isBackendAvailableTrue(
      item?.is_available
    ) &&
    (
      maxOrderQuantity > 0 ||
      remainingQuantity > 0
    )
  );
};

const isValidIngredientInventoryMenuItem = (item) => {
  if (
    !isBackendAvailableTrue(
      item?.is_available
    )
  ) {
    return false;
  }

  if (isCustomItem(item)) {
    return true;
  }

  return (
    getMaxOrderQuantity(item) > 0 ||
    getRemainingQuantity(item) > 0
  );
};

const isMenuItemDisabledByStock = (item) => {
  return !isMenuItemAvailableByBackend(item);
};

const isItemOrderable = (item) => {
  return isMenuItemAvailableByBackend(item);
};

const getAvailabilityDisplayText = (item) => {
  if (isCustomItem(item)) {
    return 'Available for request';
  }

  if (item?.unavailable_reason) {
    return String(item.unavailable_reason);
  }

  if (item?.stock_label) {
    return String(item.stock_label);
  }

  if (item?.daily_inventory_label) {
    return String(item.daily_inventory_label);
  }

  const maxQuantity =
    Math.max(
      getMaxOrderQuantity(item),
      getRemainingQuantity(item)
    );

  if (
    !isBackendAvailableTrue(
      item?.is_available
    ) ||
    maxQuantity <= 0
  ) {
    return 'Unavailable based on ingredient stock';
  }

  return `Available: ${maxQuantity}`;
};

const getMenuCardStockText = (item) => {
  return getAvailabilityDisplayText(item);
};

const isIngredientCustomItem = (item) => {
  return isCustomItem(item);
};

const canIncreaseQuantity = (
  item,
  currentQuantity,
  addQuantity = 1
) => {
  if (isCustomItem(item)) {
    return false;
  }

  const maxQuantity =
    getMaxOrderQuantity(item);

  const nextQuantity =
    Number(currentQuantity || 0) +
    Number(addQuantity || 0);

  return (
    isMenuItemAvailableByBackend(item) &&
    maxQuantity > 0 &&
    nextQuantity <= maxQuantity
  );
};

const isOutOfStock = (item) => {
  return !isMenuItemAvailableByBackend(item);
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

      const isPhoneWidth =
        width < 430;

      const isLandscapePhone =
        isLandscape &&
        shortest < 520;

      const isVeryShortLandscape =
        isLandscape &&
        height < 430;

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

      const usableWidth =
        width -
        insets.left -
        insets.right;

      const useSideCart =
        isLandscape &&
        usableWidth >= 700;

      const useCompactTopBar =
        (isPhoneWidth && !isLandscape) ||
        isLandscapePhone ||
        isVeryShortLandscape;

      const cartWidth =
        useSideCart
          ? isLandscapePhone
            ? clamp(
                usableWidth * 0.3,
                260,
                330
              )
            : clamp(
                usableWidth * 0.27,
                250,
                370
              )
          : '100%';

      const availableMenuWidth =
        useSideCart
          ? usableWidth - cartWidth
          : usableWidth;

      const menuPaddingH =
        isPhoneWidth || isLandscapePhone
          ? scale(12, 8, 14)
          : scale(18, 12, 24);

      const cardGap =
        isPhoneWidth || isLandscapePhone
          ? scale(12, 8, 14)
          : scale(20, 16, 24);

      const menuColumns =
        useSideCart
          ? isLandscapePhone
            ? clamp(
                Math.floor(
                  availableMenuWidth / 250
                ),
                1,
                2
              )
            : clamp(
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
            cardGap *
              (menuColumns - 1)
          ) / menuColumns
        );

      const imageSize =
        isLandscapePhone
          ? scale(70, 52, 74)
          : isPhoneWidth
            ? scale(64, 54, 70)
            : menuColumns > 1 &&
                !useSideCart
              ? scale(88, 66, 94)
              : scale(102, 74, 110);

      return {
        useSideCart,
        useCompactTopBar,
        cartWidth,
        menuColumns,
        menuCardWidth,
        cardGap,

        topBarMinHeight:
          useCompactTopBar
            ? isLandscapePhone
              ? scale(54, 48, 58)
              : scale(82, 76, 90)
            : isPhoneWidth
              ? scale(74, 66, 82)
              : scale(74, 62, 86),

        topBarPaddingH:
          isLandscapePhone
            ? scale(10, 8, 12)
            : isPhoneWidth
              ? scale(12, 10, 14)
              : scale(18, 12, 24),

        topBarPaddingV:
          isLandscapePhone
            ? scale(4, 3, 5)
            : isPhoneWidth
              ? scale(7, 5, 8)
              : scale(8, 6, 10),

        topTitle:
          isLandscapePhone
            ? scale(21, 17, 22)
            : isPhoneWidth
              ? scale(21, 17, 22)
              : scale(28, 20, 28),

        topSubtitle:
          isLandscapePhone
            ? scale(11, 9, 12)
            : scale(13, 10, 13),

        tableText:
          isLandscapePhone
            ? scale(14, 11, 14)
            : isPhoneWidth
              ? scale(14, 11, 14)
              : scale(20, 12, 20),

        topButtonFont:
          isLandscapePhone
            ? scale(12, 10, 12)
            : isPhoneWidth
              ? scale(13, 12, 14)
              : scale(15, 12, 16),

        topButtonPaddingV:
          isLandscapePhone
            ? scale(7, 5, 7)
            : isPhoneWidth
              ? scale(8, 7, 9)
              : scale(8, 6, 9),

        topButtonPaddingH:
          isLandscapePhone
            ? scale(10, 8, 10)
            : isPhoneWidth
              ? scale(12, 10, 14)
              : scale(14, 10, 16),

        categoryHeight:
          isLandscapePhone
            ? scale(48, 42, 50)
            : isPhoneWidth
              ? scale(54, 48, 58)
              : scale(66, 50, 68),

        categoryPaddingV:
          isLandscapePhone
            ? scale(8, 6, 8)
            : isPhoneWidth
              ? scale(10, 7, 10)
              : scale(12, 8, 12),

        categoryPaddingH:
          isLandscapePhone
            ? scale(14, 10, 15)
            : isPhoneWidth
              ? scale(16, 12, 18)
              : scale(22, 12, 22),

        categoryText:
          isLandscapePhone
            ? scale(15, 11, 15)
            : scale(18, 12, 18),

        bannerText:
          scale(16, 12, 16),

        menuPaddingTop:
          isLandscapePhone
            ? scale(9, 6, 10)
            : isPhoneWidth
              ? scale(12, 10, 14)
              : scale(18, 14, 22),

        menuPaddingH,

        itemMinHeight:
          isLandscapePhone
            ? scale(180, 150, 190)
            : isPhoneWidth
              ? scale(178, 160, 188)
              : menuColumns > 1 &&
                  !useSideCart
                ? scale(220, 195, 235)
                : scale(235, 205, 245),

        itemPadding:
          isLandscapePhone
            ? scale(9, 7, 10)
            : isPhoneWidth
              ? scale(9, 7, 10)
              : scale(13, 10, 15),

        itemRadius:
          scale(18, 14, 18),

        imageSize,
        imageRadius:
          imageSize / 2,

        itemName:
          isLandscapePhone
            ? scale(17, 13, 17)
            : isPhoneWidth
              ? scale(14, 12, 15)
              : menuColumns > 1 &&
                  !useSideCart
                ? scale(18, 13, 18)
                : scale(21, 16, 21),

        itemCategory:
          isLandscapePhone
            ? scale(11, 9, 11)
            : isPhoneWidth
              ? scale(10, 8, 11)
              : scale(12, 9, 12),

        itemPrice:
          isLandscapePhone
            ? scale(16, 12, 16)
            : isPhoneWidth
              ? scale(15, 12, 16)
              : scale(18, 13, 18),

        stockText:
          isLandscapePhone
            ? scale(12, 10, 12)
            : isPhoneWidth
              ? scale(12, 10, 13)
              : scale(15, 10, 15),

        tapText:
          isLandscapePhone
            ? scale(11, 9, 11)
            : isPhoneWidth
              ? scale(11, 9, 12)
              : scale(13, 10, 13),

        badgeText:
          isLandscapePhone
            ? scale(10, 8, 10)
            : isPhoneWidth
              ? scale(9, 8, 10)
              : scale(12, 9, 12),

        customBadgeText:
          isLandscapePhone
            ? scale(8, 7, 9)
            : isPhoneWidth
              ? scale(8, 7, 9)
              : scale(11, 8, 11),

        sidebarPaddingH:
          isLandscapePhone
            ? scale(10, 7, 12)
            : scale(14, 8, 16),

        sidebarPaddingT:
          useSideCart
            ? isLandscapePhone
              ? scale(8, 5, 9)
              : scale(12, 7, 16)
            : scale(7, 5, 9),

        sidebarPaddingBottom:
          useSideCart
            ? Math.max(
                insets.bottom + 6,
                10
              )
            : Math.max(
                insets.bottom + 2,
                6
              ),

        stackedCartMinHeight:
          clamp(
            height * 0.21,
            185,
            255
          ),

        stackedCartMaxHeight:
          clamp(
            height * 0.26,
            205,
            300
          ),

        stackedCartListMaxHeight:
          clamp(
            height * 0.12,
            86,
            125
          ),

        cartIcon:
          isLandscapePhone
            ? scale(20, 16, 20)
            : scale(24, 17, 24),

        cartTitle:
          isLandscapePhone
            ? scale(18, 14, 18)
            : scale(22, 15, 22),

        cartItemName:
          isLandscapePhone
            ? scale(13, 10, 13)
            : scale(15, 11, 15),

        cartItemPrice:
          isLandscapePhone
            ? scale(13, 10, 13)
            : scale(14, 11, 14),

        cartRequest:
          scale(13, 10, 13),

        removeText:
          isLandscapePhone
            ? scale(20, 15, 20)
            : scale(24, 17, 24),

        qtyButton:
          isLandscapePhone
            ? scale(28, 22, 28)
            : scale(30, 22, 32),

        qtyButtonText:
          isLandscapePhone
            ? scale(16, 12, 16)
            : scale(18, 13, 18),

        qtyText:
          isLandscapePhone
            ? scale(15, 11, 15)
            : scale(16, 12, 16),

        totalLabel:
          isLandscapePhone
            ? scale(16, 12, 16)
            : scale(18, 13, 18),

        totalValue:
          isLandscapePhone
            ? scale(18, 14, 18)
            : scale(22, 16, 22),

        checkoutText:
          isLandscapePhone
            ? scale(16, 12, 16)
            : scale(16, 12, 16),

        checkoutPadding:
          isLandscapePhone
            ? scale(9, 7, 9)
            : isPhoneWidth
              ? scale(10, 7, 10)
              : scale(12, 8, 12),

        searchPadding:
          isLandscapePhone
            ? scale(7, 5, 8)
            : isPhoneWidth
              ? scale(8, 6, 10)
              : scale(12, 9, 14),

        searchBottomPadding:
          isLandscapePhone
            ? scale(7, 5, 8)
            : isPhoneWidth
              ? scale(8, 6, 10)
              : scale(12, 9, 14),

        searchFont:
          isLandscapePhone
            ? scale(15, 11, 15)
            : scale(18, 12, 18),

        searchButtonText:
          isLandscapePhone
            ? scale(15, 11, 15)
            : scale(18, 12, 18),

        searchButtonPaddingV:
          isLandscapePhone
            ? scale(9, 7, 9)
            : scale(10, 7, 11),

        searchButtonPaddingH:
          isLandscapePhone
            ? scale(16, 10, 18)
            : isPhoneWidth
              ? scale(14, 10, 16)
              : scale(24, 12, 24),

        modalWidth:
          clamp(
            width * 0.86,
            300,
            420
          ),

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
      insets.left,
      insets.right,
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
    actionMenuVisible,
    setActionMenuVisible,
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

  const fetchMenu =
    useCallback(async () => {
      try {
        const response =
          await getMenu();

        const payload =
          response?.data?.success !== undefined
            ? response.data
            : response;

        console.log(
          'MENU RESPONSE:',
          payload
        );

        console.log(
          'MENU DEBUG SOURCE:',
          payload?.debug_source
        );

        if (payload?.success) {
          const rawItems =
            Array.isArray(payload.data)
              ? payload.data
              : Array.isArray(
                    payload.data?.data
                  )
                ? payload.data.data
                : [];

          console.log(
            'MOBILE MENU SOURCE OF TRUTH:',
            {
              debug_source:
                payload.debug_source,
              expected_debug_source:
                EXPECTED_MENU_DEBUG_SOURCE,
              correct_backend:
                payload.debug_source ===
                EXPECTED_MENU_DEBUG_SOURCE,
              returned_count:
                rawItems.length,
            }
          );

          const cleanedItems =
            rawItems.map((item) => ({
              ...item,
              is_available:
                isBackendAvailableTrue(
                  item?.is_available
                ),
            }));

          setMenuItems(cleanedItems);

          syncMenuInventory?.(
            cleanedItems
          );
        } else {
          Alert.alert(
            'Error',
            payload?.message ||
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
    }, [syncMenuInventory]);

  useEffect(() => {
    fetchMenu();

    const refreshTimer =
      setInterval(() => {
        fetchMenu();
      }, 15000);

    return () =>
      clearInterval(refreshTimer);
  }, [fetchMenu]);

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
      refreshTableStatus?.();
    }, [
      fetchMenu,
      refreshTableStatus,
    ])
  );

  const openLogoutModal = () => {
    setLogoutPassword('');
    setLogoutModalVisible(true);
  };

  const closeLogoutModal = () => {
    setLogoutPassword('');
    setLogoutModalVisible(false);
  };

  const handleConfirmLogout =
    async () => {
      const result =
        await logout(logoutPassword);

      if (!result?.success) {
        Alert.alert(
          'Logout Failed',
          result?.message ||
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
    item?.is_best_seller === true ||
    item?.is_best_seller === 1 ||
    item?.is_best_seller === '1' ||
    item?.is_best_seller === 'true' ||
    item?.is_best_seller === 'yes' ||

    item?.is_popular === true ||
    item?.is_popular === 1 ||
    item?.is_popular === '1' ||
    item?.is_popular === 'true' ||
    item?.is_popular === 'yes' ||

    item?.popular === true ||
    item?.popular === 1 ||
    item?.popular === '1' ||
    item?.popular === 'true' ||
    item?.popular === 'yes'
  );
};

  const checkLatestTablePermission =
    async () => {
      const latestStatus =
        await refreshTableStatus?.();

      const tableCheck =
        await ensureCanOrder?.();

      const statusToCheck =
        latestStatus || tableStatus;

      const allowed =
        tableCheck?.allowed === true &&
        getStrictOrderPermission(
          statusToCheck,
          true
        );

      return {
        allowed,
        message:
          tableCheck?.message ||
          strictAssignmentMessage,
      };
    };

  const handleOpenItem =
    async (item) => {
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
        !isValidIngredientInventoryMenuItem(
          item
        )
      ) {
        Alert.alert(
          'Unavailable',
          getAvailabilityDisplayText(
            item
          ) ||
            'This item is currently unavailable based on ingredient stock.'
        );

        return;
      }

      if (!isItemOrderable(item)) {
        Alert.alert(
          'Unavailable',
          getAvailabilityDisplayText(
            item
          ) ||
            'This item is currently unavailable.'
        );

        return;
      }

      navigation.navigate(
        'ItemDetail',
        { item }
      );
    };

  const handleIncreaseQuantity =
    (item) => {
      const enrichedItem =
        getEnrichedItem
          ? getEnrichedItem(item)
          : item;

      if (isCustomItem(enrichedItem)) {
        return;
      }

      if (
        !isValidIngredientInventoryMenuItem(
          enrichedItem
        )
      ) {
        Alert.alert(
          'Unavailable',
          getAvailabilityDisplayText(
            enrichedItem
          ) ||
            'This item is no longer available based on ingredient stock.'
        );

        return;
      }

      if (
        isMenuItemDisabledByStock(
          enrichedItem
        )
      ) {
        Alert.alert(
          'Unavailable',
          getMenuCardStockText(
            enrichedItem
          )
        );

        return;
      }

      const maxQuantity =
        getMaxOrderQuantity(
          enrichedItem
        );

      const currentQuantity =
        Number(item.quantity || 0);

      if (
        currentQuantity + 1 >
        maxQuantity
      ) {
        Alert.alert(
          'Limited Stock',
          `You can only order up to ${maxQuantity} of this item based on ingredient stock.`
        );

        return;
      }

      incrementQuantity(
        getItemId(item)
      );
    };

  const handleDecreaseQuantity =
    (item) => {
      const itemId =
        getItemId(item);

      updateQuantity(
        itemId,
        Number(item.quantity || 0) - 1
      );
    };

  const handleRemoveFromCart =
    (item) => {
      const itemId =
        getItemId(item);

      removeFromCart(itemId);
    };

  const handleCheckout =
    async () => {
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
        await refreshCartInventory?.();

      if (
        inventoryCheck &&
        inventoryCheck.valid === false
      ) {
        Alert.alert(
          'Limited Stock',
          inventoryCheck.message ||
            'Some items are no longer available.'
        );

        return;
      }

      const invalidIngredientItems =
        cartItems.filter((cartItem) => {
          const enrichedItem =
            getEnrichedItem
              ? getEnrichedItem(
                  cartItem
                )
              : cartItem;

          return (
            !isCustomItem(
              enrichedItem
            ) &&
            !isValidIngredientInventoryMenuItem(
              enrichedItem
            )
          );
        });

      if (
        invalidIngredientItems.length > 0
      ) {
        Alert.alert(
          'Unavailable Item',
          'Some items in your cart are no longer available based on ingredient stock. Please remove them before confirming your order.'
        );

        return;
      }

      if (
        !tableNumber &&
        !user?.table_number
      ) {
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

  const categories =
    useMemo(() => {
      return [
        'All',
        ...new Set(
          menuItems
            .map((m) => m.category)
            .filter(Boolean)
        ),
      ];
    }, [menuItems]);

  const filteredItems =
    useMemo(() => {
      return menuItems
        .filter((item) => {
          const byCategory =
            selectedCategory ===
              'All' ||
            item.category ===
              selectedCategory;

          const bySearch =
            !search ||
            (item.name || '')
              .toLowerCase()
              .includes(
                search.toLowerCase()
              );

          return (
            byCategory && bySearch
          );
        })
        .sort((a, b) => {
          const aPopular =
            isBestSeller(a);

          const bPopular =
            isBestSeller(b);

          const aDisabled =
            isMenuItemDisabledByStock(a);

          const bDisabled =
            isMenuItemDisabledByStock(b);

          if (
            aPopular !== bPopular
          ) {
            return (
              Number(bPopular) -
              Number(aPopular)
            );
          }

          if (
            aDisabled !== bDisabled
          ) {
            return (
              Number(aDisabled) -
              Number(bDisabled)
            );
          }

          return String(
            a.name || ''
          ).localeCompare(
            String(b.name || '')
          );
        });
    }, [
      menuItems,
      selectedCategory,
      search,
    ]);

  const totalQuantity =
    cartItems.reduce(
      (total, item) =>
        total +
        Number(item.quantity || 0),
      0
    );

  const hasCustomRequest =
    cartItems.some(
      isIngredientCustomItem
    );

  const renderMenuItem = ({
    item,
  }) => {
    const imageUri =
      getItemImage(item);

    const customItem =
      isCustomItem(item);

    const isAvailable =
      isMenuItemAvailableByBackend(item);

    const disabledByStock =
      !isAvailable;

    const availabilityText =
      getMenuCardStockText(item);

    const bestSeller =
      isBestSeller(item);

    const disabled =
      disabledByStock ||
      !strictCanOrder;

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
          <View
            style={
              styles.bestSellerBadge
            }
          >
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
          <View
            style={
              styles.customBadge
            }
          >
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
            {item.category ||
              'Uncategorized'}
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
              : `₱${formatMoney(
                  item.price
                )}`}
          </Text>

          <Text
            style={[
              !strictCanOrder ||
              !isAvailable
                ? styles.notAvailableText
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
              ? disabledByStock
                ? 'Unavailable'
                : 'Tap to view'
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
      getEnrichedItem
        ? getEnrichedItem(item)
        : item;

    const customCartItem =
      isCustomItem(enrichedItem);

    const validIngredientInventoryItem =
      customCartItem ||
      isValidIngredientInventoryMenuItem(
        enrichedItem
      );

    const atMaxQuantity =
      customCartItem ||
      !validIngredientInventoryItem
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
                : `₱${formatMoney(
                    item.price
                  )}`}
            </Text>

            {!customCartItem ? (
              <Text
                style={
                  styles.cartStockText
                }
              >
                {getMenuCardStockText(
                  enrichedItem
                )}
              </Text>
            ) : null}

            {!customCartItem &&
            !validIngredientInventoryItem ? (
              <Text
                style={
                  styles.cartInvalidText
                }
              >
                No longer available based on ingredient stock
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
                Request:{' '}
                {item.special_request}
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
          <View
            style={styles.customQtyBox}
          >
            <Text
              style={
                styles.customQtyText
              }
            >
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
                    responsive.qtyButton /
                    3,
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
                    responsive.qtyButton /
                    3,
                },
                (atMaxQuantity ||
                  isOutOfStock(
                    enrichedItem
                  )) &&
                  styles.qtyButtonDisabled,
              ]}
              disabled={atMaxQuantity}
              onPress={() => {
                if (!atMaxQuantity) {
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

            {responsive.useCompactTopBar ? (
              <View
                style={
                  styles.compactHeaderRight
                }
              >
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
                  Table{' '}
                  {tableNumber ||
                    user?.table_number ||
                    '-'}
                </Text>

                <TouchableOpacity
                  style={
                    styles.hamburgerButton
                  }
                  onPress={() =>
                    setActionMenuVisible(
                      true
                    )
                  }
                >
                  <Text
                    style={
                      styles.hamburgerText
                    }
                  >
                    ☰
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
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
                  Table{' '}
                  {tableNumber ||
                    user?.table_number ||
                    '-'}
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
                  onPress={
                    openLogoutModal
                  }
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
            )}
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
              onPress={() => {}}
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

          <FlatList
            horizontal
            data={categories}
            keyExtractor={(item) =>
              item
            }
            showsHorizontalScrollIndicator={
              false
            }
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
                  selectedCategory ===
                    category &&
                    styles.categoryBtnActive,
                ]}
                onPress={() =>
                  setSelectedCategory(
                    category
                  )
                }
              >
                <Text
                  style={[
                    styles.categoryText,
                    {
                      fontSize:
                        responsive.categoryText,
                    },
                    selectedCategory ===
                      category &&
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
            <View
              style={
                styles.assignmentBanner
              }
            >
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
                numColumns={
                  responsive.menuColumns
                }
                showsVerticalScrollIndicator={
                  false
                }
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
                  responsive.menuColumns >
                  1
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
                      : responsive.cardGap +
                        12,
                  alignItems:
                    responsive.menuColumns ===
                    1
                      ? 'center'
                      : undefined,
                }}
                ListEmptyComponent={() => (
                  <View
                    style={
                      styles.emptyMenuBox
                    }
                  >
                    <Text
                      style={
                        styles.emptyMenuTitle
                      }
                    >
                      No menu items found
                    </Text>

                    <Text
                      style={
                        styles.emptyMenuText
                      }
                    >
                      No menu items are currently available based on ingredient stock.
                    </Text>
                  </View>
                )}
              />
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
                <View
                  style={
                    styles.emptyCartBox
                  }
                >
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
                  keyExtractor={(item) =>
                    String(
                      getItemId(item)
                    )
                  }
                  renderItem={
                    renderCartItem
                  }
                  horizontal={
                    !responsive.useSideCart
                  }
                  showsHorizontalScrollIndicator={
                    !responsive.useSideCart
                  }
                  showsVerticalScrollIndicator={
                    responsive.useSideCart
                  }
                  persistentScrollbar
                  indicatorStyle="black"
                  keyboardShouldPersistTaps="handled"
                  style={[
                    responsive.useSideCart
                      ? styles.cartListSide
                      : {
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
                <Text
                  style={
                    styles.cartScrollHint
                  }
                >
                  {responsive.useSideCart
                    ? 'Scroll to see more items'
                    : 'Swipe to see more items'}
                </Text>
              ) : null}

              <View style={styles.cartFooter}>
                <View
                  style={styles.totalRow}
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
                    ₱
                    {formatMoney(
                      cartTotal
                    )}
                  </Text>
                </View>

                {hasCustomRequest ? (
                  <Text
                    style={
                      styles.cartWarningText
                    }
                  >
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
                    (cartItems.length ===
                      0 ||
                      !strictCanOrder) &&
                      styles.checkoutButtonDisabled,
                  ]}
                  disabled={
                    cartItems.length ===
                      0 ||
                    !strictCanOrder
                  }
                  onPress={
                    handleCheckout
                  }
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
                    Confirm Order (
                    {totalQuantity})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <Modal
        transparent
        visible={actionMenuVisible}
        animationType="fade"
        onRequestClose={() =>
          setActionMenuVisible(false)
        }
      >
        <TouchableOpacity
          style={styles.actionMenuOverlay}
          activeOpacity={1}
          onPress={() =>
            setActionMenuVisible(false)
          }
        >
          <View
            style={styles.actionMenuCard}
          >
            <Text
              style={
                styles.actionMenuTitle
              }
            >
              Table{' '}
              {tableNumber ||
                user?.table_number ||
                '-'}
            </Text>

            <TouchableOpacity
              style={
                styles.actionMenuItem
              }
              onPress={() => {
                setActionMenuVisible(
                  false
                );
                navigation.navigate(
                  'OrderHistory'
                );
              }}
            >
              <Text
                style={
                  styles.actionMenuItemText
                }
              >
                Order History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionMenuItem,
                styles.actionMenuItemOrange,
              ]}
              onPress={() => {
                setActionMenuVisible(
                  false
                );
                navigation.navigate(
                  'OrderStatus'
                );
              }}
            >
              <Text
                style={
                  styles.actionMenuItemTextWhite
                }
              >
                View Order Status
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionMenuItem,
                styles.actionMenuItemDark,
              ]}
              onPress={() => {
                setActionMenuVisible(
                  false
                );
                openLogoutModal();
              }}
            >
              <Text
                style={
                  styles.actionMenuItemTextWhite
                }
              >
                Staff Logout
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
              : undefined
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.modalScrollContent
            }
            keyboardShouldPersistTaps="handled"
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
                value={logoutPassword}
                onChangeText={
                  setLogoutPassword
                }
                placeholder="Password"
                placeholderTextColor="#999"
                secureTextEntry
                style={[
                  styles.passwordInput,
                  {
                    fontSize:
                      responsive.modalInput,
                  },
                ]}
              />

              <View
                style={
                  styles.modalActions
                }
              >
                <TouchableOpacity
                  style={
                    styles.cancelButton
                  }
                  onPress={
                    closeLogoutModal
                  }
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
                  style={
                    styles.confirmButton
                  }
                  onPress={
                    handleConfirmLogout
                  }
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
      justifyContent:
        'space-between',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
    },

    brandBox: {
      flexShrink: 1,
      minWidth: 120,
      maxWidth: 210,
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
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'nowrap',
      justifyContent: 'flex-end',
      gap: 8,
      flexShrink: 1,
    },

    compactHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
    },

    hamburgerButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: '#f68c45',
      justifyContent: 'center',
      alignItems: 'center',
    },

    hamburgerText: {
      color: '#fff',
      fontSize: 24,
      fontWeight: '900',
      marginTop: -2,
    },

    tableText: {
      color: '#fff',
      fontWeight: '900',
    },

    historyButton: {
      backgroundColor: '#fff',
      borderRadius: 12,
      minHeight: 36,
      justifyContent: 'center',
    },

    historyButtonText: {
      color: '#f68c45',
      fontWeight: '900',
    },

    statusButton: {
      backgroundColor: '#f68c45',
      borderRadius: 12,
      minHeight: 36,
      justifyContent: 'center',
    },

    statusButtonText: {
      color: '#fff',
      fontWeight: '800',
    },

    logoutButton: {
      backgroundColor: '#333',
      borderRadius: 12,
      minHeight: 36,
      justifyContent: 'center',
    },

    logoutButtonText: {
      color: '#fff',
      fontWeight: '800',
    },

    searchBar: {
      borderBottomWidth: 1,
      borderColor: '#ddd',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#fafafa',
      gap: 10,
      flexShrink: 0,
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

    categoryBar: {
      backgroundColor: '#f7f7f7',
      borderBottomWidth: 1,
      borderColor: '#e3e3e3',
      flexShrink: 0,
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
      minHeight: 0,
    },

    menuSection: {
      flex: 1,
      minHeight: 0,
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
      fontWeight: '800',
      color: '#222',
    },

    cartListSide: {
      flex: 1,
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
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
      marginTop: 'auto',
      flexShrink: 0,
    },

    totalRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
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

    actionMenuOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0, 0, 0, 0.35)',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      paddingTop: 70,
      paddingHorizontal: 16,
    },

    actionMenuCard: {
      width: 235,
      backgroundColor: '#fff',
      borderRadius: 18,
      padding: 14,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 8,
    },

    actionMenuTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: '#333',
      marginBottom: 10,
    },

    actionMenuItem: {
      backgroundColor: '#f7f7f7',
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      marginTop: 8,
    },

    actionMenuItemOrange: {
      backgroundColor: '#f68c45',
    },

    actionMenuItemDark: {
      backgroundColor: '#333',
    },

    actionMenuItemText: {
      color: '#333',
      fontWeight: '900',
      fontSize: 15,
    },

    actionMenuItemTextWhite: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 15,
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
      justifyContent:
        'space-between',
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