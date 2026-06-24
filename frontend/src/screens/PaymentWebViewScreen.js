import React, {
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  StatusBar,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  CommonActions,
} from '@react-navigation/native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { WebView } from 'react-native-webview';

import { useTableStatus } from '../context/TableStatusContext';

export default function PaymentWebViewScreen({
  route,
  navigation,
}) {
  const {
    orderId,
    invoiceUrl,
    message,
  } = route.params || {};

  const hasNavigatedRef =
    useRef(false);

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
        shortest < 600;

      const isVeryNarrow =
        width < 430;

      const isLandscape =
        width > height;

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

      return {
        isPhone,
        isVeryNarrow,
        isLandscape,

        safeTopExtra: 0,

        safeBottomExtra:
          Math.max(insets.bottom, 0),

        headerHeight:
          isPhone
            ? isLandscape
              ? scale(52, 44, 56)
              : scale(58, 50, 62)
            : scale(72, 58, 74),

        headerPadding:
          isVeryNarrow
            ? scale(12, 10, 14)
            : isPhone
              ? scale(14, 12, 16)
              : scale(20, 12, 22),

        sideWidth:
          isPhone
            ? isLandscape
              ? scale(58, 50, 62)
              : scale(64, 54, 68)
            : scale(76, 58, 80),

        closeText:
          isPhone
            ? scale(16, 14, 17)
            : scale(20, 15, 20),

        title:
          isVeryNarrow
            ? scale(18, 16, 19)
            : isPhone
              ? scale(19, 17, 20)
              : scale(22, 17, 22),

        loadingText:
          scale(18, 14, 18),

        errorPadding:
          isPhone
            ? scale(18, 14, 22)
            : scale(30, 18, 32),

        errorCardMaxWidth:
          Math.min(
            isPhone
              ? width - 32
              : 520,
            longest * 0.78
          ),

        errorCardRadius:
          scale(24, 16, 24),

        errorCardPaddingV:
          isPhone
            ? scale(26, 22, 30)
            : scale(34, 24, 36),

        errorCardPaddingH:
          isPhone
            ? scale(20, 16, 24)
            : scale(28, 18, 30),

        errorTitle:
          isPhone
            ? scale(26, 23, 28)
            : scale(34, 24, 34),

        errorText:
          isPhone
            ? scale(17, 15, 18)
            : scale(20, 15, 20),

        errorLine:
          isPhone
            ? scale(24, 21, 25)
            : scale(28, 21, 28),

        buttonPaddingV:
          scale(16, 12, 16),

        buttonPaddingH:
          scale(28, 20, 28),

        buttonRadius:
          scale(16, 12, 16),

        buttonText:
          scale(18, 14, 18),
      };
    }, [
      width,
      height,
      insets.bottom,
    ]);

  const {
    tableResetRequired,
    acknowledgeTableReset,
  } = useTableStatus();

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

  const markQrPaymentProcessCompleted =
    async () => {
      if (!orderId) {
        return;
      }

      try {
        const raw =
          await AsyncStorage.getItem(
            'completedQrPaymentProcessOrderIds'
          );

        const parsedIds =
          raw ? JSON.parse(raw) : [];

        const normalizedIds =
          Array.isArray(parsedIds)
            ? parsedIds.map((id) =>
                String(id)
              )
            : [];

        const orderIdString =
          String(orderId);

        if (
          !normalizedIds.includes(
            orderIdString
          )
        ) {
          normalizedIds.push(
            orderIdString
          );
        }

        await AsyncStorage.setItem(
          'completedQrPaymentProcessOrderIds',
          JSON.stringify(
            normalizedIds
          )
        );

        console.log(
          'SAVED COMPLETED QR PAYMENT PROCESS:',
          orderIdString
        );
      } catch (storageError) {
        console.log(
          'SAVE COMPLETED QR PAYMENT PROCESS ERROR:',
          storageError
        );
      }
    };

  const goToOrderStatus = ({
    statusMessage,
    qrPaymentProcessCompleted = false,
  }) => {
    if (hasNavigatedRef.current) {
      return;
    }

    hasNavigatedRef.current = true;

    navigation.replace(
      'OrderStatus',
      {
        orderId,
        message:
          statusMessage || message || '',
        qrPaymentProcessCompleted,
      }
    );
  };

  const handleNavigationChange = (
    navState
  ) => {
    const currentUrl =
      navState.url || '';

    console.log(
      'PAYMENT WEBVIEW URL:',
      currentUrl
    );

    const lowerUrl =
      currentUrl.toLowerCase();

    const isSuccess =
      lowerUrl.includes(
        'payment-success'
      ) ||
      lowerUrl.includes(
        'success'
      ) ||
      lowerUrl.includes(
        'paid'
      );

    const isFailed =
      lowerUrl.includes(
        'payment-failed'
      ) ||
      lowerUrl.includes(
        'payment-cancel'
      ) ||
      lowerUrl.includes(
        'cancel'
      ) ||
      lowerUrl.includes(
        'failure'
      ) ||
      lowerUrl.includes(
        'failed'
      );

    if (isSuccess) {
      markQrPaymentProcessCompleted();

      goToOrderStatus({
        statusMessage:
          'QR PH payment process completed. Checking payment confirmation from the system...',
        qrPaymentProcessCompleted: true,
      });

      return;
    }

    if (isFailed) {
      Alert.alert(
        'Payment Not Completed',
        'Payment was not completed. Your order will not be sent to the kitchen until payment is confirmed.'
      );

      goToOrderStatus({
        statusMessage:
          'Payment was not completed. Please ask staff for assistance or try again.',
        qrPaymentProcessCompleted: false,
      });
    }
  };

  if (!invoiceUrl) {
    return (
      <View style={styles.frameLight}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#efefef"
          translucent={false}
        />

        <SafeAreaView
          style={styles.safeAreaLight}
          edges={['top']}
        >
          <View
            style={[
              styles.errorContainer,
              {
                padding:
                  responsive.errorPadding,
              },
            ]}
          >
            <View
              style={[
                styles.errorCard,
                {
                  maxWidth:
                    responsive.errorCardMaxWidth,
                  borderRadius:
                    responsive.errorCardRadius,
                  paddingVertical:
                    responsive.errorCardPaddingV,
                  paddingHorizontal:
                    responsive.errorCardPaddingH,
                },
              ]}
            >
              <Text
                style={[
                  styles.errorTitle,
                  {
                    fontSize:
                      responsive.errorTitle,
                  },
                ]}
              >
                Payment Error
              </Text>

              <Text
                style={[
                  styles.errorText,
                  {
                    fontSize:
                      responsive.errorText,
                    lineHeight:
                      responsive.errorLine,
                  },
                ]}
              >
                No Xendit QR PH checkout link was provided.
              </Text>

              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    paddingVertical:
                      responsive.buttonPaddingV,
                    paddingHorizontal:
                      responsive.buttonPaddingH,
                    borderRadius:
                      responsive.buttonRadius,
                  },
                ]}
                onPress={() =>
                  goToOrderStatus({
                    statusMessage:
                      'Order recorded, but the Xendit checkout link was not returned. Please contact staff.',
                    qrPaymentProcessCompleted: false,
                  })
                }
              >
                <Text
                  style={[
                    styles.buttonText,
                    {
                      fontSize:
                        responsive.buttonText,
                    },
                  ]}
                  numberOfLines={1}
                >
                  Go to Order Status
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.frameWhite}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={false}
      />

      <SafeAreaView
        style={styles.safeAreaWhite}
        edges={['top']}
      >
        <View
          style={[
            styles.container,
            {
              paddingTop:
                responsive.safeTopExtra,
              paddingBottom:
                responsive.safeBottomExtra,
            },
          ]}
        >
          <View
            style={[
              styles.header,
              {
                minHeight:
                  responsive.headerHeight,
                paddingHorizontal:
                  responsive.headerPadding,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.closeButton,
                {
                  minWidth:
                    responsive.sideWidth,
                },
              ]}
              onPress={() =>
                goToOrderStatus({
                  statusMessage:
                    'Xendit QR PH checkout was closed. Your order will be sent to the kitchen after payment is confirmed.',
                  qrPaymentProcessCompleted: false,
                })
              }
            >
              <Text
                style={[
                  styles.closeText,
                  {
                    fontSize:
                      responsive.closeText,
                  },
                ]}
                numberOfLines={1}
              >
                Close
              </Text>
            </TouchableOpacity>

            <Text
              style={[
                styles.title,
                {
                  fontSize:
                    responsive.title,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Xendit QR PH Checkout
            </Text>

            <View
              style={{
                width:
                  responsive.sideWidth,
              }}
            />
          </View>

          <View style={styles.webViewWrapper}>
            <WebView
              source={{
                uri: invoiceUrl,
              }}
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled
              onNavigationStateChange={
                handleNavigationChange
              }
              renderLoading={() => (
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
                    Loading Xendit QR PH checkout...
                  </Text>
                </View>
              )}
              onError={() => {
                Alert.alert(
                  'Payment Page Error',
                  'Unable to load the Xendit checkout page. Please check your connection.'
                );
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    frameWhite: {
      flex: 1,
      backgroundColor: '#ffffff',
    },

    frameLight: {
      flex: 1,
      backgroundColor: '#efefef',
    },

    safeAreaWhite: {
      flex: 1,
      backgroundColor: '#ffffff',
    },

    safeAreaLight: {
      flex: 1,
      backgroundColor: '#efefef',
    },

    container: {
      flex: 1,
      backgroundColor: '#ffffff',
    },

    header: {
      backgroundColor: '#ffffff',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: '#ddd',
    },

    closeButton: {
      paddingVertical: 8,
      paddingHorizontal: 4,
      justifyContent: 'center',
      alignItems: 'flex-start',
    },

    closeText: {
      fontWeight: '900',
      color: '#f68c45',
    },

    title: {
      flex: 1,
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
      paddingHorizontal: 10,
    },

    webViewWrapper: {
      flex: 1,
      backgroundColor: '#ffffff',
    },

    loadingContainer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },

    loadingText: {
      marginTop: 12,
      color: '#333',
      fontWeight: '700',
      textAlign: 'center',
    },

    errorContainer: {
      flex: 1,
      backgroundColor: '#efefef',
      alignItems: 'center',
      justifyContent: 'center',
    },

    errorCard: {
      width: '100%',
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#f0b287',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },

    errorTitle: {
      fontWeight: '900',
      color: '#f68c45',
      marginBottom: 12,
      textAlign: 'center',
    },

    errorText: {
      color: '#333',
      textAlign: 'center',
      marginBottom: 24,
      fontWeight: '700',
    },

    button: {
      backgroundColor: '#f68c45',
      alignItems: 'center',
    },

    buttonText: {
      color: '#fff',
      fontWeight: '900',
      textAlign: 'center',
    },
  });