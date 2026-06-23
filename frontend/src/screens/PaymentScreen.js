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

      const isPhone =
        width < 600;

      const isVeryNarrow =
        width < 430;

      const isLandscape =
        width > height;

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

      const methodCardWidth =
        isVeryNarrow
          ? clamp(width - 44, 250, 340)
          : isPhone
            ? clamp(width * 0.86, 260, 390)
            : clamp(width * 0.26, 190, 270);

      const methodCardHeight =
        isPhone
          ? scale(135, 116, 145)
          : scale(245, 155, 250);

      return {
        isPhone,
        isVeryNarrow,
        isLandscape,

        safeTopExtra:
          isPhone
            ? 6
            : 8,

        safeBottomExtra:
          Math.max(insets.bottom + 10, 18),

        containerPadding:
          isVeryNarrow
            ? scale(14, 12, 16)
            : isPhone
              ? scale(18, 14, 20)
              : scale(32, 18, 34),

        topGap:
          scale(12, 8, 14),

        backText:
          isPhone
            ? scale(17, 15, 18)
            : scale(28, 17, 28),

        tableText:
          isPhone
            ? scale(17, 15, 18)
            : scale(24, 16, 24),

        logo:
          isPhone
            ? scale(56, 44, 60)
            : scale(80, 50, 80),

        header:
          isVeryNarrow
            ? scale(36, 32, 38)
            : isPhone
              ? scale(42, 34, 44)
              : scale(58, 36, 60),

        headerMargin:
          isPhone
            ? scale(18, 12, 20)
            : scale(24, 14, 24),

        subHeader:
          isPhone
            ? scale(23, 20, 24)
            : scale(34, 22, 34),

        warningWidth:
          isPhone
            ? '100%'
            : '86%',

        warningMaxWidth:
          clamp(longest * 0.82, 320, 980),

        warningPaddingV:
          scale(14, 10, 14),

        warningPaddingH:
          scale(18, 12, 18),

        warningText:
          scale(18, 12, 18),

        warningLine:
          scale(25, 18, 25),

        methodGap:
          isPhone
            ? scale(16, 14, 18)
            : scale(20, 12, 20),

        methodCardWidth,

        methodCardHeight,

        methodRadius:
          scale(22, 15, 22),

        methodIcon:
          isPhone
            ? scale(48, 40, 52)
            : scale(82, 52, 82),

        methodIconMargin:
          isPhone
            ? scale(8, 6, 10)
            : scale(18, 10, 18),

        methodText:
          isPhone
            ? scale(21, 18, 23)
            : scale(30, 19, 30),

        footerWidth:
          isPhone
            ? '100%'
            : '88%',

        footerMaxWidth:
          clamp(longest * 0.75, 320, 920),

        footerMargin:
          isPhone
            ? scale(24, 18, 28)
            : scale(38, 24, 38),

        footerPaddingV:
          isPhone
            ? scale(16, 13, 18)
            : scale(24, 16, 24),

        footerPaddingH:
          isPhone
            ? scale(16, 13, 18)
            : scale(32, 18, 32),

        footerRadius:
          scale(18, 13, 18),

        totalText:
          isPhone
            ? scale(25, 21, 27)
            : scale(38, 24, 38),

        buttonPaddingV:
          scale(18, 12, 18),

        buttonPaddingH:
          isPhone
            ? scale(26, 20, 28)
            : scale(40, 24, 40),

        buttonRadius:
          scale(20, 14, 20),

        buttonText:
          isPhone
            ? scale(18, 16, 19)
            : scale(24, 17, 24),

        disclaimer:
          scale(17, 12, 17),

        loadingText:
          scale(20, 15, 20),
      };
    }, [
      width,
      height,
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
  ] = useState('Pay at Counter');

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

        return (
          category === 'chef oppa special' ||
          inventoryType === 'custom'
        );
      });
    }, [cartItems]);

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

    setSelectedMethod(method);
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

    if (
      selectedMethod === 'QR PH' &&
      hasCustomRequest
    ) {
      Alert.alert(
        'QR PH Not Available',
        'Chef Oppa Special requests must be confirmed by staff. QR PH payment is not available for custom requests.'
      );

      return;
    }

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

      const orderResponse =
        await placeOrder(
          cartItems,
          finalTableNumber,
          selectedMethod
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

      clearCart();
      setActiveOrderId(orderId);

      if (selectedMethod === 'QR PH') {
        if (!invoiceUrl) {
          Alert.alert(
            'Payment Error',
            'No Xendit invoice URL was returned. Please contact restaurant staff.'
          );

          navigation.replace(
            'OrderStatus',
            { orderId }
          );

          return;
        }

        navigation.replace(
          'PaymentWebView',
          {
            orderId,
            invoiceUrl,
          }
        );

        return;
      }

      navigation.replace(
        'OrderStatus',
        { orderId }
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
    disabled = false,
  }) => {
    const active =
      selectedMethod === method;

    return (
      <TouchableOpacity
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
        >
          {method}
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
          >
            Payment
          </Text>

          <Text
            style={[
              styles.subHeader,
              {
                fontSize:
                  responsive.subHeader,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
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
            {renderMethod({
              method: 'Pay at Counter',
              icon: '💵',
            })}

            {renderMethod({
              method: 'Pay Later',
              icon: '🧾',
            })}

            {renderMethod({
              method: 'QR PH',
              icon: '📱',
              disabled: hasCustomRequest,
            })}
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
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
    },

    topLeft: {
      flex: 1,
      minWidth: 110,
      alignItems: 'flex-start',
    },

    topRight: {
      flex: 1,
      minWidth: 60,
      alignItems: 'flex-end',
    },

    backText: {
      color: '#3b3b3b',
      fontWeight: '800',
    },

    tableText: {
      flex: 1,
      minWidth: 110,
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
      marginBottom: 22,
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
      marginTop: 10,
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

    footer: {
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: '#d0d0d0',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
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
      marginTop: 18,
      textAlign: 'center',
      fontWeight: '800',
      color: '#666',
    },
  });