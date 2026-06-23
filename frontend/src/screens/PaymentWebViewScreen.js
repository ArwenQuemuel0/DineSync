import React, {
  useEffect,
  useMemo,
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

import { WebView } from 'react-native-webview';

import { useTableStatus } from '../context/TableStatusContext';

export default function PaymentWebViewScreen({
  route,
  navigation,
}) {
  const {
    orderId,
    invoiceUrl,
  } = route.params || {};

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

      return {
        isPhone,
        isVeryNarrow,

        safeTopExtra:
          isPhone
            ? 6
            : 8,

        safeBottomExtra:
          Math.max(insets.bottom, 0),

        headerHeight:
          isPhone
            ? scale(58, 52, 62)
            : scale(72, 58, 74),

        headerPadding:
          isVeryNarrow
            ? scale(12, 10, 14)
            : isPhone
              ? scale(14, 12, 16)
              : scale(20, 12, 22),

        sideWidth:
          isPhone
            ? scale(62, 54, 66)
            : scale(70, 56, 74),

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

  const handleNavigationChange = (
    navState
  ) => {
    const currentUrl =
      navState.url || '';

    console.log(
      'PAYMENT WEBVIEW URL:',
      currentUrl
    );

    const isSuccess =
      currentUrl.includes(
        'payment-success'
      );

    const isFailed =
      currentUrl.includes(
        'payment-failed'
      ) ||
      currentUrl.includes(
        'payment-cancel'
      ) ||
      currentUrl.includes(
        'failure'
      );

    if (isSuccess) {
      navigation.replace(
        'OrderStatus',
        { orderId }
      );

      return;
    }

    if (isFailed) {
      Alert.alert(
        'Payment Status',
        'Payment was not completed. You can check the order status or ask restaurant staff for help.'
      );

      navigation.replace(
        'OrderStatus',
        { orderId }
      );
    }
  };

  if (!invoiceUrl) {
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
                No payment link was provided.
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
                  navigation.replace(
                    'OrderStatus',
                    { orderId }
                  )
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
    <View style={styles.frame}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={false}
      />

      <SafeAreaView
        style={styles.safeAreaWhite}
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
                navigation.replace(
                  'OrderStatus',
                  { orderId }
                )
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
              Complete Payment
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
                    Loading payment page...
                  </Text>
                </View>
              )}
              onError={() => {
                Alert.alert(
                  'Payment Page Error',
                  'Unable to load the payment page. Please check your connection.'
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
    frame: {
      flex: 1,
      backgroundColor: '#ffffff',
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
      backgroundColor: '#efefef',
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
      backgroundColor: '#efefef',
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