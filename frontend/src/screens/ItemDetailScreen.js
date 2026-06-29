import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

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
} from "react-native";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  useFocusEffect,
  CommonActions,
} from "@react-navigation/native";

import {
  getMenu,
  getDishRecommendations,
} from "../api/dinesync";

import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useTableStatus } from "../context/TableStatusContext";

import {
  getItemId,
  isItemOrderable,
  isOutOfStock,
  canIncreaseQuantity,
  getAvailabilityDisplayText,
  shouldShowLowStockWarning,
  isCustomItem,
  isValidIngredientInventoryMenuItem,
} from "../utils/inventory";

const normalizeText = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase();
};

const normalizeInventoryType = (value) => {
  return normalizeText(value).replace(/[-\s]+/g, "_");
};

const isAvailableTrue = (value) => {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    normalizeText(value) === "true" ||
    normalizeText(value) === "yes" ||
    normalizeText(value) === "available"
  );
};

const hasDailyLimit = (item) => {
  return (
    item?.daily_limit !== null &&
    item?.daily_limit !== undefined &&
    String(item.daily_limit).trim() !== ""
  );
};

const toNumber = (value) => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
};

const getRemainingToday = (item) => {
  if (!item) {
    return 0;
  }

  if (isCustomItem(item)) {
    return 1;
  }

  return toNumber(
    item?.remaining_today ??
      item?.available_quantity ??
      item?.max_order_quantity ??
      0
  );
};

const getMaxOrderQuantity = (item) => {
  if (!item) {
    return 0;
  }

  if (isCustomItem(item)) {
    return 1;
  }

  return toNumber(
    item?.max_order_quantity ??
      item?.remaining_today ??
      item?.available_quantity ??
      0
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
  return isValidIngredientInventoryMenuItem(item);
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

      const longest =
        Math.max(width, height);

      const isLandscape =
        width > height;

      const isPhone =
        shortest < 600;

      const isSmallPhone =
        shortest < 390;

      const isTablet =
        shortest >= 600;

      const isPhoneLandscape =
        isPhone &&
        isLandscape;

      const compactLandscape =
        isLandscape &&
        height < 520;

      const veryCompactLandscape =
        isLandscape &&
        height < 420;

      const usableWidth =
        width -
        insets.left -
        insets.right;

      const usableHeight =
        height -
        insets.top -
        insets.bottom;

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
          ? shortest / 390
          : shortest / 768;

      const scale = (
        size,
        min = size * 0.72,
        max = size * 1.12
      ) => {
        return Math.round(
          clamp(size * base, min, max)
        );
      };

      const useSideCart =
        isLandscape &&
        usableWidth >= 680 &&
        usableHeight >= 320;

      const isTabletLandscape =
        isTablet &&
        isLandscape &&
        usableWidth >= 740;

      const sideCartWidth =
        useSideCart
          ? isPhoneLandscape
            ? clamp(usableWidth * 0.32, 260, 330)
            : clamp(usableWidth * 0.28, 275, 380)
          : "100%";

      const detailWidth =
        useSideCart
          ? usableWidth - sideCartWidth
          : usableWidth;

      const isBottomCartCompact =
        !useSideCart;

      const topBarHeight =
        veryCompactLandscape
          ? clamp(usableHeight * 0.13, 42, 52)
          : isPhone
            ? scale(56, 48, 62)
            : scale(66, 56, 74);

      const bottomCartHeight =
        !useSideCart
          ? isPhoneLandscape
            ? clamp(usableHeight * 0.40, 175, 225)
            : isPhone
              ? clamp(usableHeight * 0.30, 220, 292)
              : isTablet && !isLandscape
                ? clamp(usableHeight * 0.27, 250, 320)
                : clamp(usableHeight * 0.28, 190, 255)
          : undefined;

      const cartListMaxHeight =
        useSideCart
          ? undefined
          : isPhoneLandscape
            ? Math.max(48, bottomCartHeight * 0.26)
            : Math.max(74, bottomCartHeight * 0.38);

      const sideCartListMaxHeight =
        useSideCart
          ? isPhoneLandscape
            ? clamp(usableHeight * 0.34, 96, 145)
            : compactLandscape
              ? clamp(usableHeight * 0.38, 120, 180)
              : clamp(usableHeight * 0.48, 170, 300)
          : undefined;

      const detailPadding =
        useSideCart
          ? isPhoneLandscape
            ? scale(9, 7, 11)
            : isTabletLandscape
              ? scale(16, 12, 20)
              : compactLandscape
                ? scale(10, 8, 12)
                : scale(14, 10, 18)
          : isPhoneLandscape
            ? scale(8, 6, 10)
            : isPhone
              ? scale(10, 8, 12)
              : isTablet && !isLandscape
                ? scale(18, 14, 24)
                : scale(14, 10, 18);

      const maxCardWidth =
        useSideCart
          ? Math.max(detailWidth - detailPadding * 2, 280)
          : isPhoneLandscape
            ? clamp(usableWidth - 24, 430, 720)
            : isPhone
              ? clamp(usableWidth - 24, 300, 560)
              : isTablet && !isLandscape
                ? clamp(usableWidth - 64, 560, 860)
                : clamp(usableWidth - 52, 500, 740);

      const cardPadding =
        isPhoneLandscape
          ? scale(10, 8, 12)
          : isLandscape
            ? isTablet
              ? scale(18, 15, 22)
              : scale(9, 7, 11)
            : isPhone
              ? scale(13, 10, 15)
              : isTablet && !isLandscape
                ? scale(20, 16, 24)
                : scale(12, 9, 14);

      const imageSize =
        useSideCart && isPhoneLandscape
          ? scale(60, 48, 66)
          : isTabletLandscape
            ? scale(76, 62, 90)
            : isPhoneLandscape
              ? scale(52, 42, 58)
              : isLandscape
                ? isPhone
                  ? scale(50, 42, 56)
                  : scale(86, 72, 100)
                : isPhone
                  ? scale(92, 78, 106)
                  : isTablet && !isLandscape
                    ? scale(132, 112, 150)
                    : scale(82, 66, 92);

      const recommendationWidth =
        useSideCart
          ? isPhoneLandscape
            ? clamp(detailWidth * 0.48, 220, 300)
            : isTabletLandscape
              ? clamp(detailWidth * 0.38, 250, 345)
              : clamp(detailWidth * 0.44, 260, 390)
          : isPhoneLandscape
            ? clamp(usableWidth * 0.42, 230, 320)
            : isPhone
              ? clamp(usableWidth * 0.78, 250, 330)
              : clamp(usableWidth * 0.42, 300, 390);

      const recommendationRightWidth =
        veryCompactLandscape
          ? scale(58, 52, 64)
          : isPhone
            ? scale(66, 58, 74)
            : scale(88, 74, 98);

      const recommendationMinHeight =
        isPhoneLandscape
          ? scale(58, 50, 64)
          : isLandscape
            ? isPhone
              ? scale(52, 46, 58)
              : scale(76, 66, 88)
            : isPhone
              ? scale(82, 72, 94)
              : isTablet && !isLandscape
                ? scale(98, 86, 110)
                : scale(72, 62, 82);

      const recommendationCircle =
        isPhoneLandscape
          ? scale(36, 30, 40)
          : isLandscape
            ? isPhone
              ? scale(32, 28, 36)
              : scale(56, 48, 64)
            : isPhone
              ? scale(54, 46, 62)
              : isTablet && !isLandscape
                ? scale(70, 58, 80)
                : scale(48, 40, 54);

      const cartItemName =
        !useSideCart
          ? isPhoneLandscape
            ? scale(11, 9, 12)
            : isPhone
              ? scale(12, 10, 13)
              : scale(13, 11, 14)
          : isPhoneLandscape
            ? scale(12, 10, 13)
            : scale(14, 12, 16);

      const cartItemPrice =
        !useSideCart
          ? isPhoneLandscape
            ? scale(11, 9, 12)
            : isPhone
              ? scale(12, 10, 13)
              : scale(13, 11, 14)
          : isPhoneLandscape
            ? scale(12, 10, 13)
            : scale(13, 11, 15);

      return {
        isPhone,
        isTablet,
        isLandscape,
        isPhoneLandscape,
        isTabletLandscape,
        compactLandscape,
        veryCompactLandscape,
        useSideCart,
        isBottomCartCompact,

        cartWidth:
          sideCartWidth,

        bottomSafeExtra:
          useSideCart
            ? Math.max(insets.bottom + 8, 12)
            : Math.max(
              insets.bottom +
              (Platform.OS === "android" ? 14 : 10),
              16
            ),

        topBarHeight,

        topBarPaddingH:
          isPhoneLandscape
            ? scale(12, 8, 14)
            : isPhone
              ? scale(14, 12, 16)
              : scale(22, 16, 28),

        topText:
          veryCompactLandscape
            ? scale(15, 13, 16)
            : isPhone
              ? scale(18, 15, 20)
              : scale(24, 18, 28),

        tableText:
          veryCompactLandscape
            ? scale(14, 12, 15)
            : isPhone
              ? scale(16, 13, 17)
              : scale(22, 16, 24),

        detailPadding,

        detailBottomPadding:
          useSideCart
            ? scale(18, 12, 22)
            : isPhoneLandscape
              ? 10
              : isLandscape
                ? 10
                : scale(14, 10, 18),

        detailScrollJustify:
          "flex-start",

        cardPadding,

        cardRadius:
          scale(24, 18, 28),

        detailCardWidth:
          useSideCart
            ? Math.max(detailWidth - detailPadding * 2, 280)
            : "100%",

        detailCardHeight:
          undefined,

        detailCardMinHeight:
          undefined,

        detailScrollMinHeight:
          undefined,

        detailScrollAlignItems:
          "center",

        cardJustifyContent:
          "flex-start",

        imageSize,

        imageRadius:
          imageSize / 2,

        emoji:
          veryCompactLandscape
            ? scale(38, 32, 44)
            : isPhone
              ? scale(58, 44, 64)
              : scale(76, 54, 84),

        itemName:
          useSideCart && isPhoneLandscape
            ? scale(20, 16, 22)
            : isTabletLandscape
              ? scale(22, 18, 24)
              : isPhoneLandscape
                ? scale(18, 15, 19)
                : isLandscape
                  ? isPhone
                    ? scale(18, 15, 19)
                    : scale(26, 21, 29)
                  : isPhone
                    ? scale(23, 19, 26)
                    : isTablet && !isLandscape
                      ? scale(32, 26, 36)
                      : scale(23, 19, 25),

        itemPrice:
          useSideCart && isPhoneLandscape
            ? scale(17, 14, 19)
            : isTabletLandscape
              ? scale(18, 15, 20)
              : isPhoneLandscape
                ? scale(15, 12, 16)
                : isLandscape
                  ? isPhone
                    ? scale(14, 12, 15)
                    : scale(22, 18, 25)
                  : isPhone
                    ? scale(18, 15, 20)
                    : isTablet && !isLandscape
                      ? scale(25, 20, 28)
                      : scale(19, 15, 21),

        category:
          veryCompactLandscape
            ? scale(11, 10, 12)
            : isPhone
              ? scale(13, 11, 14)
              : scale(16, 13, 18),

        tagText:
          veryCompactLandscape
            ? scale(8, 7, 9)
            : isPhone
              ? scale(10, 8, 11)
              : scale(12, 10, 13),

        stockText:
          veryCompactLandscape
            ? scale(12, 10, 13)
            : isPhone
              ? scale(15, 12, 16)
              : scale(18, 14, 20),

        limitText:
          veryCompactLandscape
            ? scale(11, 10, 12)
            : isPhone
              ? scale(12, 10, 13)
              : scale(15, 12, 16),

        description:
          isPhoneLandscape
            ? scale(11, 9, 12)
            : isLandscape
              ? isPhone
                ? scale(10, 9, 11)
                : scale(14, 11, 16)
              : isPhone
                ? scale(14, 12, 15)
                : isTablet && !isLandscape
                  ? scale(17, 14, 18)
                  : scale(13, 11, 14),

        descriptionLine:
          isPhoneLandscape
            ? scale(15, 13, 16)
            : isLandscape
              ? isPhone
                ? scale(13, 11, 14)
                : scale(19, 15, 21)
              : isPhone
                ? scale(19, 16, 20)
                : isTablet && !isLandscape
                  ? scale(23, 19, 25)
                  : scale(17, 14, 18),

        label:
          scale(17, 13, 18),

        inputFont:
          scale(16, 13, 16),

        inputHeight:
          isPhone
            ? scale(92, 78, 102)
            : scale(110, 90, 120),

        buttonText:
          isPhoneLandscape
            ? scale(16, 14, 17)
            : isPhone
              ? scale(18, 15, 20)
              : isTablet
                ? scale(18, 15, 20)
                : scale(17, 14, 18),

        buttonPaddingV:
          veryCompactLandscape
            ? scale(8, 6, 9)
            : isPhone
              ? scale(12, 10, 14)
              : isTablet && !isLandscape
                ? scale(14, 11, 16)
                : scale(12, 9, 14),

        buttonPaddingH:
          isPhoneLandscape
            ? scale(30, 24, 36)
            : isPhone
              ? scale(26, 20, 32)
              : scale(34, 26, 40),

        recommendationTitle:
          veryCompactLandscape
            ? scale(14, 12, 15)
            : isPhone
              ? scale(17, 14, 18)
              : isTablet && !isLandscape
                ? scale(20, 16, 22)
                : scale(17, 14, 18),

        recommendationWidth,
        recommendationRightWidth,
        recommendationMinHeight,
        recommendationCircle,

        recommendationName:
          veryCompactLandscape
            ? scale(11, 10, 12)
            : isPhone
              ? scale(13, 11, 14)
              : scale(16, 13, 17),

        recommendationLine:
          veryCompactLandscape
            ? scale(13, 12, 14)
            : isPhone
              ? scale(16, 14, 17)
              : scale(20, 16, 21),

        recommendationPrice:
          veryCompactLandscape
            ? scale(10, 9, 11)
            : isPhone
              ? scale(12, 10, 13)
              : scale(15, 12, 16),

        recommendationAddText:
          veryCompactLandscape
            ? scale(10, 9, 11)
            : isPhone
              ? scale(12, 10, 13)
              : scale(14, 12, 15),

        recommendationAddPaddingH:
          veryCompactLandscape
            ? scale(8, 7, 10)
            : isPhone
              ? scale(10, 8, 12)
              : scale(18, 14, 22),

        recommendationAddPaddingV:
          veryCompactLandscape
            ? scale(4, 3, 5)
            : isPhone
              ? scale(5, 4, 6)
              : scale(7, 6, 8),

        recommendationAddMinWidth:
          veryCompactLandscape
            ? scale(42, 38, 46)
            : isPhone
              ? scale(50, 44, 56)
              : scale(72, 64, 78),

        imageMarginBottom:
          useSideCart
            ? 5
            : isLandscape
              ? 3
              : isPhone
                ? 8
                : 10,

        priceMarginTop:
          isLandscape
            ? 3
            : isPhone
              ? 4
              : 6,

        categoryMarginTop:
          isLandscape
            ? 3
            : isPhone
              ? 3
              : 5,

        tagMarginTop:
          isPhoneLandscape
            ? 4
            : isLandscape
              ? 3
              : isPhone
                ? 5
                : 6,

        stockMarginTop:
          isLandscape
            ? 5
            : isPhone
              ? 5
              : 7,

        limitMarginTop:
          isLandscape
            ? 3
            : isPhone
              ? 4
              : 5,

        descriptionMarginTop:
          isLandscape
            ? 8
            : isPhone
              ? 8
              : 10,

        addButtonMarginTop:
          isPhoneLandscape
            ? 9
            : isLandscape
              ? 7
              : isPhone
                ? 12
                : 14,

        recommendationMarginTop:
          isPhoneLandscape
            ? 10
            : isLandscape
              ? 8
              : isPhone
                ? 12
                : 16,

        recommendationTitleMarginBottom:
          veryCompactLandscape
            ? 5
            : isPhone
              ? 8
              : 12,

        recommendationCardPaddingH:
          veryCompactLandscape
            ? 8
            : isPhone
              ? 10
              : 14,

        recommendationCardPaddingV:
          veryCompactLandscape
            ? 5
            : isPhone
              ? 7
              : 10,

        recommendationCardMarginH:
          isPhone
            ? 5
            : 8,

        recommendationCircleMarginRight:
          veryCompactLandscape
            ? 7
            : isPhone
              ? 8
              : 12,

        sidebarPaddingH:
          useSideCart
            ? isPhoneLandscape
              ? scale(10, 7, 12)
              : compactLandscape
                ? scale(10, 8, 12)
                : scale(14, 10, 16)
            : scale(12, 10, 14),

        sidebarPaddingT:
          useSideCart
            ? isPhoneLandscape
              ? scale(10, 7, 12)
              : compactLandscape
                ? scale(10, 8, 12)
                : scale(14, 10, 16)
            : isPhoneLandscape
              ? scale(6, 5, 8)
              : scale(8, 6, 10),

        cartHeight:
          bottomCartHeight,

        cartIcon:
          veryCompactLandscape
            ? scale(18, 16, 20)
            : scale(22, 18, 24),

        cartTitle:
          useSideCart
            ? isPhoneLandscape
              ? scale(19, 15, 20)
              : scale(20, 16, 22)
            : isPhone
              ? scale(16, 13, 17)
              : scale(18, 14, 19),

        cartItemName,
        cartItemPrice,

        cartRequest:
          scale(13, 11, 13),

        removeText:
          useSideCart
            ? scale(24, 18, 24)
            : scale(20, 17, 22),

        qtyButton:
          useSideCart
            ? isPhoneLandscape
              ? scale(28, 22, 30)
              : scale(30, 25, 32)
            : scale(26, 22, 29),

        qtyButtonText:
          scale(17, 14, 18),

        qtyText:
          scale(16, 13, 16),

        totalLabel:
          useSideCart
            ? isPhoneLandscape
              ? scale(16, 12, 16)
              : scale(17, 13, 18)
            : scale(14, 12, 15),

        totalValue:
          useSideCart
            ? isPhoneLandscape
              ? scale(18, 14, 18)
              : scale(20, 16, 21)
            : scale(16, 13, 17),

        checkoutText:
          useSideCart
            ? isPhoneLandscape
              ? scale(16, 13, 16)
              : scale(18, 16, 19)
            : isPhoneLandscape
              ? scale(15, 13, 16)
              : scale(16, 15, 17),

        checkoutPadding:
          useSideCart
            ? isPhoneLandscape
              ? scale(9, 7, 9)
              : scale(12, 10, 13)
            : isPhoneLandscape
              ? scale(8, 7, 9)
              : scale(10, 8, 11),

        errorText:
          scale(26, 18, 26),

        backButtonText:
          scale(18, 14, 18),

        maxCardWidth,

        cartPhoneListMaxHeight:
          cartListMaxHeight,

        cartSideListMaxHeight:
          sideCartListMaxHeight,
      };
    }, [
      width,
      height,
      insets.top,
      insets.left,
      insets.right,
      insets.bottom,
    ]);

  const { item: routeItem } =
    route.params || {};

  const [liveItem, setLiveItem] =
    useState(routeItem);

  const [
    specialRequest,
    setSpecialRequest,
  ] = useState("");

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
    liveItem ||
    routeItem;

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
            name: "Welcome",
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
          !Array.isArray(response.data)
        ) {
          return;
        }

       const visibleItems =
  response.data.filter(
    isValidIngredientInventoryMenuItem
  );
        syncMenuInventory(
          visibleItems
        );

        const freshItem =
          response.data.find(
            (menuItem) =>
              String(menuItem.id) ===
              String(routeItem.id)
          );

        if (freshItem) {
          setLiveItem(freshItem);
        }
      } catch (error) {
        console.log(
          "ITEM INVENTORY REFRESH ERROR:",
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

     const fetchRecommendations =
  async () => {
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
            isValidIngredientInventoryMenuItem
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
        "AI RECOMMENDATIONS ERROR:",
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
      : "0.00";
  };

  const getItemImage = (data) => {
    const image =
      data?.image_url
        ? String(data.image_url).trim()
        : data?.image
          ? String(data.image).trim()
          : "";

    return image;
  };

  const getItemDescription = (data) => {
    const description =
      data?.description ||
      data?.item_description ||
      data?.details ||
      data?.desc ||
      "";

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
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  };

  const getMealType = (data) => {
    return data?.meal_type
      ? String(data.meal_type).trim()
      : null;
  };

  const getCurrentCartQuantityForItem = (data) => {
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
    ? "Custom request available"
    : getAvailabilityDisplayText(item);

  const itemDescription =
    getItemDescription(item);

  const flavorTags =
    getFlavorTags(item);

  const mealType =
    getMealType(item);

  const handleAddToCart = async () => {
  if (!item) {
    return;
  }

  const tableCheck =
    await ensureCanOrder();

  if (!tableCheck.allowed) {
    Alert.alert(
      "Table Not Assigned",
      tableCheck.message ||
        assignmentMessage
    );

    return;
  }

  if (
    !isValidIngredientInventoryMenuItem(
      item
    )
  ) {
    Alert.alert(
      "Unavailable",
      getAvailabilityDisplayText(item) ||
        "This item is currently unavailable based on ingredient stock."
    );

    return;
  }

  if (!isAvailable) {
    Alert.alert(
      "Out of Stock",
      getAvailabilityDisplayText(item) ||
        "This item is currently out of stock."
    );

    return;
  }

  if (customItem) {
    const requestText =
      specialRequest.trim();

    if (!requestText) {
      Alert.alert(
        "Chef Oppa Special Request",
        "Please describe your Chef Oppa Special request before adding it to cart."
      );

      return;
    }

    if (currentCartQuantity >= 1) {
      Alert.alert(
        "Already Added",
        "Chef Oppa Special can only be added once per order."
      );

      return;
    }

    addToCart({
      ...item,
      quantity: 1,
      price: 0,
      notes: requestText,
      special_request: requestText,
      inventory_type: "custom",
    });

    setSpecialRequest("");

    return;
  }

  if (allowedQuantity <= 0) {
    Alert.alert(
      "Out of Stock",
      getAvailabilityDisplayText(item) ||
        "This item is currently out of stock."
    );

    return;
  }

  if (!canAddMoreCurrentItem) {
    Alert.alert(
      "Limited Stock",
      `You can only order up to ${allowedQuantity} of this item.`
    );

    return;
  }

  addToCart(item);
};
  const handleAddRecommendedItem =
    async (recommendedItem) => {
      if (!recommendedItem) {
        return;
      }

      const tableCheck =
        await ensureCanOrder();

      if (!tableCheck.allowed) {
        Alert.alert(
          "Table Not Assigned",
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
  "Unavailable",
  getAvailabilityDisplayText(recommendedItem) ||
    "This recommended item is currently unavailable based on ingredient stock."
);

        return;
      }

      if (
        !isItemOrderable(
          recommendedItem
        )
      ) {
        Alert.alert(
          "Out of Stock",
          "This recommended item is currently out of stock."
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
          "Limited Stock",
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
      "ItemDetail",
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
  "Unavailable",
  getAvailabilityDisplayText(enrichedItem) ||
    "This item is no longer available based on ingredient stock."
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
        "Limited Stock",
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
        "Limited Stock",
        getAvailabilityDisplayText(
          enrichedItem
        ) ||
        "You reached the available quantity for this item."
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

    removeFromCart(
      cartItemId
    );
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert(
        "Empty Order",
        "Please add at least one item before proceeding."
      );

      return;
    }

    const tableCheck =
      await ensureCanOrder();

    if (!tableCheck.allowed) {
      Alert.alert(
        "Table Not Assigned",
        tableCheck.message ||
        assignmentMessage
      );

      return;
    }

    const inventoryCheck =
      await refreshCartInventory();

    if (!inventoryCheck.valid) {
      Alert.alert(
        "Limited Stock",
        inventoryCheck.message
      );

      return;
    }

   const invalidIngredientInventoryItems =
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
      invalidIngredientInventoryItems.length > 0
    ) {
      Alert.alert(
        "Unavailable Item",
       "Some items in your cart are no longer available based on ingredient stock. Please remove them before confirming your order."
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
        "Limited Stock",
        "Some items exceed the available ingredient stock. Please adjust your cart before confirming your order."
      );

      return;
    }

    if (!finalTableNumber) {
      Alert.alert(
        "Table Error",
        "No table number found. Please login again using the assigned table account."
      );

      return;
    }

    navigation.navigate(
      "OrderConfirm",
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
                ? "To be confirmed"
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
                ? "Request"
                : "Add"}
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

    const validIngredientInventoryItem =
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
      !validIngredientInventoryItem ||
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
                ? "To be confirmed"
                : `₱${formatMoney(cartItem.price)}`}
            </Text>

            {responsive.useSideCart &&
              !customCartItem &&
              allowedCartQuantity > 0 ? (
              <Text style={styles.cartLimitText}>
                Limit: {allowedCartQuantity}
              </Text>
            ) : null}

            {!customCartItem &&
              !validIngredientInventoryItem? (
              <Text style={styles.cartInvalidText}>
                No longer available based on ingredient stock
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
          edges={[
            "top",
            "left",
            "right",
            "bottom",
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
          "top",
          "left",
          "right",
          "bottom",
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
                {"<"} Go Back
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
                Table {finalTableNumber || "-"}
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
                    ? "row"
                    : "column",
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
                    justifyContent:
                      responsive.detailScrollJustify,
                    alignItems:
                      responsive.detailScrollAlignItems,
                    minHeight:
                      responsive.detailScrollMinHeight ||
                      "100%",
                  },
                ]}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={true}
              >
                <View
                  style={[
                    styles.detailCard,
                    {
                      width:
                        responsive.detailCardWidth,
                      maxWidth:
                        responsive.useSideCart
                          ? undefined
                          : responsive.maxCardWidth,
                      minHeight:
                        responsive.detailCardMinHeight,
                      height:
                        responsive.detailCardHeight,
                      padding:
                        responsive.cardPadding,
                      borderRadius:
                        responsive.cardRadius,
                      justifyContent:
                        responsive.cardJustifyContent,
                      alignSelf:
                        responsive.useSideCart
                          ? "center"
                          : "center",
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
                      ? "To be confirmed by staff"
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
                    {item.category || "Uncategorized"}
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
                      ? "Table not assigned"
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
                      ? "Price and availability will be confirmed by staff. QR PH is disabled for Chef Oppa Special requests."
                      : itemDescription ||
                      "No description available for this item."}
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
                      minimumFontScale={0.75}
                    >
                      {!canOrder
                        ? "Waiting for Staff"
                        : customItem
                          ? currentCartQuantity >= 1
                            ? "Request Already Added"
                            : "Add Request to Cart"
                         : !isValidForMobile
  ? "Unavailable"
  : allowedQuantity <= 0
    ? "Out of Stock"
                              : !canAddMoreCurrentItem
                                ? "Limit Reached"
                                : "Add to Order"}
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
                        showsHorizontalScrollIndicator={true}
                        contentContainerStyle={{
                          paddingHorizontal: 4,
                          paddingBottom: 4,
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
                  height:
                    responsive.useSideCart
                      ? "100%"
                      : responsive.cartHeight,
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
                  borderTopLeftRadius:
                    responsive.useSideCart
                      ? 0
                      : 18,
                  borderTopRightRadius:
                    responsive.useSideCart
                      ? 0
                      : 18,
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
                  showsHorizontalScrollIndicator={!responsive.useSideCart}
                  showsVerticalScrollIndicator={responsive.useSideCart}
                  persistentScrollbar={true}
                  indicatorStyle="black"
                  style={[
                    styles.cartList,
                    responsive.useSideCart
                      ? [
                        styles.cartListSide,
                        {
                          maxHeight:
                            responsive.cartSideListMaxHeight,
                        },
                      ]
                      : {
                        maxHeight:
                          responsive.isPhoneLandscape
                            ? 56
                            : responsive.cartPhoneListMaxHeight,
                        minHeight:
                          responsive.isPhoneLandscape
                            ? 48
                            : 78,
                      },
                  ]}
                  contentContainerStyle={{
                    paddingBottom:
                      responsive.useSideCart
                        ? 18
                        : 6,
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
                    ? "Scroll to see more items"
                    : "Swipe to see more items"}
                </Text>
              ) : null}

             <View
                style={[
                  styles.cartFooter,
                  {
                    paddingBottom:
                      responsive.useSideCart
                        ? 10
                        : 2,
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
      backgroundColor: "#fff",
    },

    safeArea: {
      flex: 1,
      backgroundColor: "#b8b3b3",
    },

    container: {
      flex: 1,
      backgroundColor: "#efefef",
    },

    topBar: {
      backgroundColor: "#b8b3b3",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      gap: 12,
      flexShrink: 0,
    },

    topBarText: {
      color: "#fff",
      fontWeight: "800",
    },

    topIcons: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 0,
    },

    tableText: {
      color: "#fff",
      fontWeight: "900",
    },

    assignmentBanner: {
      backgroundColor: "#fff4e8",
      borderWidth: 1,
      borderColor: "#f68c45",
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginHorizontal: 12,
      marginTop: 10,
      marginBottom: 4,
    },

    assignmentBannerText: {
      color: "#8a4b12",
      fontWeight: "800",
      textAlign: "center",
      lineHeight: 22,
    },

    contentArea: {
      flex: 1,
      minHeight: 0,
    },

    detailSection: {
      flex: 1,
      minHeight: 0,
    },

    detailScroll: {
      flex: 1,
      width: "100%",
    },

    detailScrollContent: {
      flexGrow: 1,
      width: "100%",
    },

    detailCard: {
      width: "100%",
      backgroundColor: "#fff",
      borderWidth: 1.5,
      borderColor: "#f0b287",
      alignItems: "center",
      alignSelf: "center",
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },

    imageCircle: {
      backgroundColor: "#ececec",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
      marginBottom: 14,
    },

    itemImage: {
      width: "100%",
      height: "100%",
    },

    itemEmoji: {},

    itemName: {
      fontWeight: "900",
      color: "#333",
      textAlign: "center",
      width: "100%",
    },

    itemPrice: {
      color: "#f68c45",
      marginTop: 8,
      fontWeight: "800",
      textAlign: "center",
      width: "100%",
    },

    itemCategory: {
      marginTop: 6,
      fontWeight: "800",
      color: "#777",
      textAlign: "center",
    },

    flavorTagContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      marginTop: 8,
      gap: 6,
    },

    flavorTag: {
      backgroundColor: "#fff4eb",
      borderWidth: 1,
      borderColor: "#f68c45",
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },

    flavorTagText: {
      color: "#f68c45",
      fontWeight: "900",
      textTransform: "capitalize",
    },

    mealTypeText: {
      marginTop: 8,
      color: "#777",
      fontSize: 14,
      fontWeight: "900",
      textTransform: "capitalize",
    },

    availableText: {
      color: "#4CAF50",
      fontWeight: "800",
      marginTop: 8,
      textAlign: "center",
    },

    notAvailableText: {
      color: "red",
      fontWeight: "800",
      marginTop: 8,
      textAlign: "center",
    },

    lowStockText: {
      color: "#e67e22",
      fontWeight: "800",
      marginTop: 8,
      textAlign: "center",
    },

    limitText: {
      marginTop: 6,
      color: "#666",
      fontWeight: "900",
      textAlign: "center",
    },

    description: {
      marginTop: 14,
      color: "#666",
      textAlign: "center",
      width: "100%",
    },

    specialRequestBox: {
      width: "100%",
      marginTop: 18,
    },

    specialRequestLabel: {
      fontWeight: "900",
      color: "#333",
      marginBottom: 8,
      textAlign: "left",
    },

    specialRequestInput: {
      width: "100%",
      backgroundColor: "#fafafa",
      borderWidth: 1.5,
      borderColor: "#f0b287",
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: "#333",
      fontWeight: "600",
      lineHeight: 22,
    },

    addToOrderButton: {
      marginTop: 20,
      backgroundColor: "#f68c45",
      borderRadius: 999,
      minWidth: 150,
      minHeight: 44,
      paddingHorizontal: 24,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
    },

    addToOrderButtonDisabled: {
      backgroundColor: "#c9c9c9",
    },

    addToOrderText: {
      color: "#fff",
      fontWeight: "900",
      textAlign: "center",
      includeFontPadding: false,
    },

    recommendationSection: {
      width: "100%",
      marginTop: 22,
      paddingBottom: 12,
    },

    recommendationTitle: {
      fontWeight: "900",
      color: "#333",
      marginBottom: 12,
      textAlign: "center",
    },

    recommendationCard: {
      backgroundColor: "#fff7ef",
      borderWidth: 1,
      borderColor: "#f0b287",
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginHorizontal: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      overflow: "hidden",
    },

    recommendationCardDisabled: {
      opacity: 0.45,
    },

    recommendationLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      paddingRight: 12,
      minWidth: 0,
    },

    recommendationCircle: {
      backgroundColor: "#ffe1ca",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
      marginRight: 12,
      flexShrink: 0,
    },

    recommendationImage: {
      width: "100%",
      height: "100%",
    },

    recommendationEmoji: {
      fontSize: 30,
    },

    recommendationTextBox: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
    },

    recommendationName: {
      width: "100%",
      fontWeight: "900",
      color: "#333",
    },

    recommendationRight: {
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },

    recommendationPrice: {
      width: "100%",
      fontWeight: "900",
      color: "#f68c45",
      marginTop: 3,
      textAlign: "left",
    },

    recommendationAddButton: {
      backgroundColor: "#f68c45",
      paddingVertical: 7,
      borderRadius: 10,
      minWidth: 74,
      alignItems: "center",
    },

    recommendationAddButtonDisabled: {
      backgroundColor: "#c9c9c9",
    },

    recommendationAddText: {
      color: "#fff",
      fontWeight: "900",
    },

    noRecommendationText: {
      textAlign: "center",
      color: "#999",
      fontSize: 16,
    },

    cartSidebar: {
      backgroundColor: "#fff",
      borderLeftColor: "#ddd",
      borderTopColor: "#ddd",
      flexShrink: 0,
      overflow: "hidden",
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
    },

    cartList: {
      flexGrow: 0,
      minHeight: 42,
    },

    cartListSide: {
      flexGrow: 0,
      minHeight: 96,
      marginBottom: 8,
    },

    cartScrollHint: {
      color: "#999",
      fontSize: 11,
      fontWeight: "800",
      textAlign: "center",
      paddingTop: 2,
      paddingBottom: 3,
    },

    cartHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },

    cartIcon: {
      marginRight: 8,
    },

    cartTitle: {
      fontWeight: "800",
      color: "#222",
    },

    emptyCartText: {
      color: "#777",
      marginTop: 2,
      borderBottomWidth: 1,
      borderBottomColor: "#dddddd",
      paddingBottom: 6,
    },

    cartItem: {
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: "#eeeeee",
      minWidth: 170,
      maxWidth: 230,
    },

    cartItemBottom: {
      borderBottomWidth: 0,
      borderRightWidth: 1,
      borderRightColor: "#eeeeee",
      paddingRight: 10,
    },

    cartItemTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },

    cartItemInfo: {
      flex: 1,
      paddingRight: 8,
    },

    cartItemName: {
      fontWeight: "800",
      color: "#222",
    },

    cartItemPrice: {
      fontWeight: "700",
      color: "#f68c45",
      marginTop: 3,
    },

    cartLimitText: {
      marginTop: 3,
      color: "#666",
      fontSize: 11,
      fontWeight: "900",
    },

    cartInvalidText: {
      marginTop: 3,
      color: "#b00020",
      fontSize: 11,
      fontWeight: "900",
    },

    cartRequestText: {
      marginTop: 4,
      color: "#666",
      fontWeight: "700",
      lineHeight: 18,
    },

    customQtyBox: {
      marginTop: 8,
      alignSelf: "flex-start",
      backgroundColor: "#fff4eb",
      borderWidth: 1,
      borderColor: "#f0b287",
      borderRadius: 10,
      paddingVertical: 5,
      paddingHorizontal: 9,
    },

    customQtyText: {
      fontSize: 13,
      color: "#f68c45",
      fontWeight: "900",
    },

    cartWarningText: {
      backgroundColor: "#fff4eb",
      color: "#7a3f09",
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 9,
      fontSize: 12,
      fontWeight: "800",
      lineHeight: 17,
      marginBottom: 7,
    },

    removeText: {
      fontWeight: "800",
      color: "#999",
    },

    qtyRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },

    qtyButton: {
      backgroundColor: "#f68c45",
      justifyContent: "center",
      alignItems: "center",
    },

    qtyButtonDisabled: {
      backgroundColor: "#c9c9c9",
    },

    qtyButtonText: {
      color: "#fff",
      fontWeight: "800",
    },

    qtyText: {
      fontWeight: "800",
      marginHorizontal: 10,
    },

    cartFooter: {
      borderTopWidth: 1,
      borderTopColor: "#dddddd",
      paddingTop: 7,
      flexShrink: 0,
    },

    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 5,
      gap: 10,
    },

    totalLabel: {
      fontWeight: "800",
      color: "#333",
    },

    totalValue: {
      fontWeight: "900",
      color: "#f68c45",
      flexShrink: 1,
      textAlign: "right",
    },

    checkoutButton: {
      backgroundColor: "#f68c45",
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 42,
      paddingHorizontal: 18,
    },

    checkoutButtonDisabled: {
      backgroundColor: "#c9c9c9",
    },

    checkoutButtonText: {
      color: "#fff",
      fontWeight: "900",
      textAlign: "center",
      includeFontPadding: false,
    },

    emptyState: {
      flex: 1,
      backgroundColor: "#efefef",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },

    errorText: {
      fontWeight: "800",
      color: "#333",
      textAlign: "center",
    },

    backButton: {
      marginTop: 24,
      backgroundColor: "#f68c45",
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 12,
    },

    backButtonText: {
      color: "#fff",
      fontWeight: "800",
    },
  });