import React, {
  useMemo,
  useState,
} from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  useWindowDimensions,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  placeOrder,
  extractApiErrorMessage,
} from '../api/dinesync';

import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTableStatus } from '../context/TableStatusContext';
import { TABLE_ASSIGNMENT_MESSAGE } from '../constants/tableStatus';

export default function PaymentScreen({
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

      const usableWidth =
        width -
        insets.left -
        insets.right;

      const usableHeight =
        height -
        insets.top -
        insets.bottom;

      const isPhone =
        shortest < 600;

      const isVeryNarrow =
        usableWidth < 390;

      const isLandscape =
        width > height;

      const isShortHeight =
        usableHeight < 650;

      const isShortLandscape =
        isLandscape &&
        usableHeight < 430;

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
          ? Math.min(shortest / 390, 1)
          : Math.min(shortest / 768, 1.05);

      const scale = (
        size,
        min = size * 0.72,
        max = size * 1.12
      ) => {
        return Math.round(
          clamp(size * base, min, max)
        );
      };

      const compact =
        isPhone ||
        isShortHeight;

      const methodColumns =
        isLandscape && usableWidth >= 720
          ? 3
          : 1;

      const methodGap =
        isPhone
          ? isLandscape
            ? scale(10, 8, 12)
            : scale(14, 12, 16)
          : scale(20, 12, 20);

      const methodAvailableWidth =
        usableWidth -
        (
          isVeryNarrow
            ? 24
            : isPhone
              ? 28
              : 64
        );

      const methodCardWidth =
        methodColumns === 3
          ? clamp(
            (
              methodAvailableWidth -
              methodGap * 2
            ) / 3,
            isPhone ? 170 : 220,
            isPhone ? 235 : 340
          )
          : isPhone
            ? isVeryNarrow
              ? clamp(methodAvailableWidth, 260, 350)
              : clamp(usableWidth * 0.88, 280, 420)
            : clamp(usableWidth * 0.52, 360, 460);

      const methodCardHeight =
        methodColumns === 3
          ? isShortLandscape
            ? clamp(usableHeight * 0.32, 118, 148)
            : isPhone
              ? clamp(usableHeight * 0.34, 130, 165)
              : clamp(usableHeight * 0.34, 180, 240)
          : isPhone
            ? scale(158, 138, 172)
            : scale(230, 175, 255);

      return {
        isPhone,
        isVeryNarrow,
        isLandscape,
        compact,
        methodColumns,

        safeTopExtra: 0,

        safeBottomExtra:
          Math.max(
            insets.bottom +
            (Platform.OS === 'android' ? 10 : 8),
            16
          ),

        containerPadding:
          isVeryNarrow
            ? scale(14, 12, 16)
            : isPhone
              ? isLandscape
                ? scale(12, 10, 14)
                : scale(18, 14, 20)
              : scale(32, 18, 34),

        topGap:
          scale(12, 8, 14),

        backText:
          isVeryNarrow
            ? scale(14, 12, 15)
            : isPhone
              ? scale(16, 14, 17)
              : scale(26, 18, 28),

        tableText:
          isVeryNarrow
            ? scale(14, 12, 15)
            : isPhone
              ? scale(16, 14, 17)
              : scale(24, 16, 24),

        logo:
          isPhone
            ? isLandscape
              ? scale(44, 36, 48)
              : scale(56, 44, 62)
            : scale(80, 50, 82),

        header:
          isVeryNarrow
            ? scale(32, 28, 34)
            : isPhone
              ? isLandscape
                ? scale(32, 28, 34)
                : scale(40, 34, 42)
              : scale(56, 38, 60),

        headerMargin:
          isPhone
            ? isLandscape
              ? scale(10, 8, 12)
              : scale(16, 10, 18)
            : scale(22, 14, 24),

        subHeader:
          isPhone
            ? isLandscape
              ? scale(18, 16, 19)
              : scale(22, 19, 24)
            : scale(32, 22, 34),

        subHeaderBottom:
          isPhone
            ? isLandscape
              ? scale(10, 8, 12)
              : scale(18, 14, 20)
            : scale(22, 16, 24),

        warningWidth:
          isPhone
            ? '100%'
            : '86%',

        warningMaxWidth:
          clamp(longest * 0.82, 320, 980),

        warningPaddingV:
          scale(12, 8, 13),

        warningPaddingH:
          scale(16, 12, 18),

        warningText:
          isPhone
            ? scale(14, 12, 15)
            : scale(18, 12, 18),

        warningLine:
          isPhone
            ? scale(20, 17, 21)
            : scale(25, 18, 25),

        methodGap,

        methodCardWidth,

        methodCardHeight,

        methodRadius:
          scale(22, 15, 22),

        methodIcon:
          isPhone
            ? isLandscape
              ? scale(34, 28, 36)
              : scale(42, 34, 46)
            : scale(68, 44, 70),

        methodIconMargin:
          isPhone
            ? isLandscape
              ? scale(5, 4, 6)
              : scale(8, 6, 10)
            : scale(14, 8, 15),

        methodText:
          isPhone
            ? isLandscape
              ? scale(16, 14, 17)
              : scale(20, 17, 22)
            : scale(27, 18, 28),

        methodSubtitle:
          isPhone
            ? isLandscape
              ? scale(11, 10, 12)
              : scale(13, 12, 14)
            : scale(16, 13, 17),

        methodSubtitleLine:
          isPhone
            ? isLandscape
              ? scale(15, 13, 16)
              : scale(18, 16, 19)
            : scale(23, 18, 24),

        footerWidth:
          isPhone
            ? '100%'
            : '88%',

        footerMaxWidth:
          clamp(longest * 0.75, 320, 920),

        footerMargin:
          isPhone
            ? isLandscape
              ? scale(14, 10, 16)
              : scale(22, 16, 26)
            : scale(34, 22, 38),

        footerPaddingV:
          isPhone
            ? scale(14, 11, 16)
            : scale(22, 16, 24),

        footerPaddingH:
          isPhone
            ? scale(14, 12, 16)
            : scale(32, 18, 32),

        footerRadius:
          scale(18, 13, 18),

        totalText:
          isPhone
            ? isLandscape
              ? scale(19, 16, 20)
              : scale(24, 20, 26)
            : scale(38, 24, 38),

        buttonPaddingV:
          isPhone
            ? scale(14, 10, 15)
            : scale(18, 12, 18),

        buttonPaddingH:
          isPhone
            ? scale(24, 18, 26)
            : scale(40, 24, 40),

        buttonRadius:
          scale(20, 14, 20),

        buttonText:
          isPhone
            ? scale(17, 15, 19)
            : scale(24, 17, 24),

        disclaimer:
          isPhone
            ? scale(14, 12, 15)
            : scale(17, 12, 17),

        loadingText:
          isPhone
            ? scale(17, 15, 19)
            : scale(20, 15, 20),
      };
    }, [
      width,
      height,
      insets.top,
      insets.left,
      insets.right,
      insets.bottom,
    ]);

  const {
    cartItems: routeCartItems = [],
    total: routeTotal = 0,
    tableNumber: routeTableNumber,
  } = route.params || {};

  const {
    tableNumber,
    user,
  } = useAuth();

  const finalTableNumber =
    routeTableNumber ||
    tableNumber ||
    user?.table_number;

  const {
    cartItems: contextCartItems,
    cartTotal,
    clearCart,
    setActiveOrderId,
    refreshCartInventory,
  } = useCart();

  const cartItems =
    contextCartItems.length > 0
      ? contextCartItems
      : routeCartItems;

  const total =
    contextCartItems.length > 0
      ? cartTotal
      : routeTotal;

  const {
    ensureCanOrder,
    assignmentMessage,
  } = useTableStatus();

  const [loading, setLoading] =
    useState(false);

  const [
    selectedMethod,
    setSelectedMethod,
  ] = useState('Pay Later');

  const paymentOptions =
    useMemo(() => {
      return [
        {
          method: 'Pay Later',
          apiMethod: 'Pay Later',
          icon: '🧾',
          subtitle:
            'Send your order to the kitchen now and settle payment later with staff.',
        },
        {
          method: 'Pay at Counter',
          apiMethod: 'Pay at Counter',
          icon: '💵',
          subtitle:
            'Pay first at the cashier before your order is sent to the kitchen.',
        },
        {
          method: 'QR PH',
          apiMethod: 'Digital Payment',
          icon: '📱',
          subtitle:
            'Pay securely through Xendit QR PH checkout.',
        },
      ];
    }, []);

  const hasCustomRequest =
    useMemo(() => {
      return cartItems.some((item) => {
        const category =
          String(item?.category || '')
            .trim()
            .toLowerCase();

        const inventoryType =
          String(item?.inventory_type || '')
            .trim()
            .toLowerCase();

        const name =
          String(item?.name || '')
            .trim()
            .toLowerCase();

        return (
          category === 'chef oppa special' ||
          inventoryType === 'custom' ||
          name.includes(
            'custom chef oppa special'
          )
        );
      });
    }, [cartItems]);

  const getSelectedOption = () => {
    const option =
      paymentOptions.find(
        (item) =>
          item.method === selectedMethod
      ) || paymentOptions[0];

    if (
      hasCustomRequest &&
      option.method === 'QR PH'
    ) {
      return paymentOptions[0];
    }

    return option;
  };

  const handleSelectMethod = (
    method
  ) => {
    if (
      method === 'QR PH' &&
      hasCustomRequest
    ) {
      Alert.alert(
        'QR PH Not Available',
        'Chef Oppa Special requests must be confirmed by staff. QR PH payment is not available for custom requests.'
      );

      return;
    }

    const selectedOption =
      paymentOptions.find(
        (option) =>
          option.method === method
      );

    console.log(
      'PAYMENT SCREEN SELECTED METHOD:',
      {
        method,
        apiMethod:
          selectedOption?.apiMethod,
      }
    );

    setSelectedMethod(method);
  };

  const getConfirmationMessage = (
    method
  ) => {
    if (method === 'Pay Later') {
      return 'Order sent to kitchen. Please settle payment later with staff.';
    }

    if (method === 'Pay at Counter') {
      return 'Order recorded. Please proceed to the counter to pay before the kitchen prepares your order.';
    }

    return 'Opening Xendit QR PH checkout. Your order will be sent to the kitchen after payment is confirmed.';
  };

  const goToOrderStatusWithMessage = (
    orderId,
    message
  ) => {
    Alert.alert(
      'Order Confirmed',
      message,
      [
        {
          text: 'OK',
          onPress: () => {
            navigation.replace(
              'OrderStatus',
              {
                orderId,
                message,
              }
            );
          },
        },
      ]
    );
  };

  const openPaymentWithMessage = ({
    orderId,
    invoiceUrl,
    message,
  }) => {
    Alert.alert(
      'Order Recorded',
      message,
      [
        {
          text: 'Open Checkout',
          onPress: () => {
            navigation.replace(
              'PaymentWebView',
              {
                orderId,
                invoiceUrl,
                message,
              }
            );
          },
        },
      ]
    );
  };

  const handlePayment = async () => {
    if (
      !cartItems ||
      cartItems.length === 0
    ) {
      Alert.alert(
        'Empty Order',
        'There are no items to process.'
      );

      navigation.goBack();

      return;
    }

    if (!finalTableNumber) {
      Alert.alert(
        'Table Error',
        'No table number found. Please login again using the assigned table account.'
      );

      return;
    }

    const paymentSnapshot =
      getSelectedOption();

    if (
      paymentSnapshot.method === 'QR PH' &&
      hasCustomRequest
    ) {
      Alert.alert(
        'QR PH Not Available',
        'Chef Oppa Special requests must be confirmed by staff. QR PH payment is not available for custom requests.'
      );

      return;
    }

    console.log(
      'PAYMENT SCREEN SNAPSHOT:',
      {
        selectedMethod,
        method:
          paymentSnapshot.method,
        apiMethod:
          paymentSnapshot.apiMethod,
      }
    );

    setLoading(true);

    try {
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

      console.log(
        'PAYMENT SCREEN SUBMIT ORDER:',
        {
          method:
            paymentSnapshot.method,
          apiMethod:
            paymentSnapshot.apiMethod,
        }
      );

      const orderResponse =
        await placeOrder(
          cartItems,
          finalTableNumber,
          paymentSnapshot.apiMethod
        );

      if (
        !orderResponse.success ||
        !orderResponse.data
      ) {
        Alert.alert(
          'Order Failed',
          orderResponse.message ||
            'Unable to create order.'
        );

        return;
      }

      const orderId =
        orderResponse.order_id ||
        orderResponse.data.id;

      const invoiceUrl =
        orderResponse.invoice_url ||
        orderResponse.xendit_invoice_url ||
        orderResponse.data.invoice_url ||
        orderResponse.data.xendit_invoice_url;

      if (!orderId) {
        Alert.alert(
          'Order Error',
          'Order was created but no order ID was returned.'
        );

        return;
      }

      const confirmationMessage =
        getConfirmationMessage(
          paymentSnapshot.method
        );

      clearCart();
      setActiveOrderId(orderId);

      if (
        paymentSnapshot.method === 'QR PH'
      ) {
        if (!invoiceUrl) {
          Alert.alert(
            'Payment Error',
            'No Xendit QR PH checkout link was returned. Please ask restaurant staff for help.'
          );

          navigation.replace(
            'OrderStatus',
            {
              orderId,
              message:
                'Order recorded, but the Xendit QR PH checkout link was not returned. Please contact staff.',
            }
          );

          return;
        }

        openPaymentWithMessage({
          orderId,
          invoiceUrl,
          message:
            confirmationMessage,
        });

        return;
      }

      goToOrderStatusWithMessage(
        orderId,
        confirmationMessage
      );
    } catch (error) {
      console.error(
        'Payment failed:',
        error
      );

      const errorMessage =
        extractApiErrorMessage(
          error,
          'Order failed. Please try again.'
        );

      const statusCode =
        error?.response?.status;

      const isAssignmentError =
        statusCode === 403 ||
        errorMessage ===
          TABLE_ASSIGNMENT_MESSAGE;

      const isInventoryError =
        statusCode === 422 ||
        statusCode === 400;

      Alert.alert(
        isAssignmentError
          ? 'Table Not Assigned'
          : isInventoryError
            ? 'Limited Stock'
            : 'Order Failed',
        errorMessage
      );
    } finally {
      setLoading(false);
    }
  };

  const renderMethod = ({
    method,
    icon,
    subtitle,
    disabled = false,
  }) => {
    const active =
      selectedMethod === method;

    return (
      <TouchableOpacity
        key={method}
        style={[
          styles.methodCard,
          {
            width:
              responsive.methodCardWidth,
            minHeight:
              responsive.methodCardHeight,
            borderRadius:
              responsive.methodRadius,
          },
          active &&
            styles.methodCardActive,
          disabled &&
            styles.methodCardDisabled,
        ]}
        disabled={disabled}
        onPress={() =>
          handleSelectMethod(method)
        }
      >
        <Text
          style={[
            styles.methodIcon,
            {
              fontSize:
                responsive.methodIcon,
              marginBottom:
                responsive.methodIconMargin,
            },
          ]}
        >
          {icon}
        </Text>

        <Text
          style={[
            styles.methodText,
            {
              fontSize:
                responsive.methodText,
            },
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {method}
        </Text>

        <Text
          style={[
            styles.methodSubtitle,
            {
              fontSize:
                responsive.methodSubtitle,
              lineHeight:
                responsive.methodSubtitleLine,
            },
          ]}
          numberOfLines={
            responsive.isLandscape
              ? 3
              : 4
          }
          adjustsFontSizeToFit
          minimumFontScale={0.78}
        >
          {subtitle}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.frame}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#efefef"
          translucent={false}
        />

        <SafeAreaView
          style={styles.safeAreaLight}
          edges={[
            'top',
            'left',
            'right',
            'bottom',
          ]}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color="#f68c45"
            />

            <Text
              style={[
                styles.loadingText,
                {
                  fontSize:
                    responsive.loadingText,
                },
              ]}
            >
              Processing Order...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#efefef"
        translucent={false}
      />

      <SafeAreaView
        style={styles.safeAreaLight}
        edges={[
          'top',
          'left',
          'right',
          'bottom',
        ]}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.scrollContent,
            {
              padding:
                responsive.containerPadding,
              paddingTop:
                responsive.containerPadding +
                responsive.safeTopExtra,
              paddingBottom:
                responsive.safeBottomExtra +
                responsive.containerPadding,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View
            style={[
              styles.topRow,
              {
                gap:
                  responsive.topGap,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.topLeft}
              onPress={() =>
                navigation.goBack()
              }
            >
              <Text
                style={[
                  styles.backText,
                  {
                    fontSize:
                      responsive.backText,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {'<'} Go Back
              </Text>
            </TouchableOpacity>

            <Text
              style={[
                styles.tableText,
                {
                  fontSize:
                    responsive.tableText,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Table {finalTableNumber || '-'}
            </Text>

            <View style={styles.topRight}>
              <Image
                source={require('../../assets/chefoppa_logo.png')}
                style={[
                  styles.logo,
                  {
                    width:
                      responsive.logo,
                    height:
                      responsive.logo,
                  },
                ]}
                resizeMode="contain"
              />
            </View>
          </View>

          <Text
            style={[
              styles.header,
              {
                fontSize:
                  responsive.header,
                marginTop:
                  responsive.headerMargin,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            Payment
          </Text>

          <Text
            style={[
              styles.subHeader,
              {
                fontSize:
                  responsive.subHeader,
                marginBottom:
                  responsive.subHeaderBottom,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            Select Payment Method
          </Text>

          {hasCustomRequest ? (
            <View
              style={[
                styles.warningBox,
                {
                  width:
                    responsive.warningWidth,
                  maxWidth:
                    responsive.warningMaxWidth,
                  paddingVertical:
                    responsive.warningPaddingV,
                  paddingHorizontal:
                    responsive.warningPaddingH,
                },
              ]}
            >
              <Text
                style={[
                  styles.warningText,
                  {
                    fontSize:
                      responsive.warningText,
                    lineHeight:
                      responsive.warningLine,
                  },
                ]}
              >
                Chef Oppa Special requests must be confirmed by staff. QR PH payment is not available for custom requests.
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.methodRow,
              {
                gap:
                  responsive.methodGap,
              },
            ]}
          >
            {paymentOptions.map((option) =>
              renderMethod({
                method: option.method,
                icon: option.icon,
                subtitle:
                  option.subtitle,
                disabled:
                  option.method ===
                    'QR PH' &&
                  hasCustomRequest,
              })
            )}
          </View>

          <View
            style={[
              styles.footer,
              responsive.isPhone &&
                styles.footerPhone,
              {
                width:
                  responsive.footerWidth,
                maxWidth:
                  responsive.footerMaxWidth,
                marginTop:
                  responsive.footerMargin,
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
              minimumFontScale={0.75}
            >
              Total: ₱
              {Number(total || 0).toFixed(2)}
            </Text>

            <TouchableOpacity
              style={[
                styles.payNowBtn,
                {
                  paddingVertical:
                    responsive.buttonPaddingV,
                  paddingHorizontal:
                    responsive.buttonPaddingH,
                  borderRadius:
                    responsive.buttonRadius,
                },
              ]}
              onPress={handlePayment}
            >
              <Text
                style={[
                  styles.payNowText,
                  {
                    fontSize:
                      responsive.buttonText,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                Confirm Order
              </Text>
            </TouchableOpacity>
          </View>

          <Text
            style={[
              styles.disclaimer,
              {
                fontSize:
                  responsive.disclaimer,
              },
            ]}
          >
            Once confirmed, the order cannot be cancelled or changed.
          </Text>
        </ScrollView>
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

    safeAreaLight: {
      flex: 1,
      backgroundColor: '#efefef',
    },

    container: {
      flex: 1,
      backgroundColor: '#efefef',
    },

    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },

    topRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      flexWrap: 'nowrap',
    },

    topLeft: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start',
    },

    topRight: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-end',
    },

    backText: {
      color: '#3b3b3b',
      fontWeight: '800',
    },

    tableText: {
      flex: 1,
      minWidth: 0,
      color: '#3b3b3b',
      fontWeight: '900',
      textAlign: 'center',
    },

    logo: {},

    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#efefef',
      paddingHorizontal: 24,
    },

    loadingText: {
      marginTop: 10,
      fontWeight: '800',
      color: '#333',
      textAlign: 'center',
    },

    header: {
      fontWeight: '900',
      textAlign: 'center',
      color: '#f68c45',
    },

    subHeader: {
      textAlign: 'center',
      marginTop: 8,
      fontWeight: '800',
      color: '#444',
    },

    warningBox: {
      alignSelf: 'center',
      backgroundColor: '#fff3e8',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 16,
      marginBottom: 22,
    },

    warningText: {
      fontWeight: '800',
      color: '#7a3f09',
      textAlign: 'center',
    },

    methodRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: 8,
    },

    methodCard: {
      borderWidth: 1.5,
      borderColor: '#f0b287',
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },

    methodCardActive: {
      backgroundColor: '#fff3e8',
      borderColor: '#f68c45',
      borderWidth: 2,
    },

    methodCardDisabled: {
      opacity: 0.4,
      backgroundColor: '#dddddd',
    },

    methodIcon: {},

    methodText: {
      color: '#373737',
      fontWeight: '900',
      textAlign: 'center',
    },

    methodSubtitle: {
      marginTop: 8,
      color: '#666',
      fontWeight: '700',
      textAlign: 'center',
    },

    footer: {
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: '#d0d0d0',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent:
        'space-between',
      alignItems: 'center',
      backgroundColor: '#fafafa',
      gap: 14,
    },

    footerPhone: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },

    totalText: {
      flex: 1,
      minWidth: 180,
      fontWeight: '900',
      color: '#333',
    },

    payNowBtn: {
      backgroundColor: '#f68c45',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },

    payNowText: {
      color: '#fff',
      fontWeight: '900',
      textAlign: 'center',
    },

    disclaimer: {
      marginTop: 16,
      textAlign: 'center',
      fontWeight: '800',
      color: '#666',
    },
  });