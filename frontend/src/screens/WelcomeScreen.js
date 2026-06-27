import React, {
  useMemo,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ImageBackground,
  StatusBar,
  useWindowDimensions,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';

export default function WelcomeScreen({
  navigation,
}) {
  const { user, tableNumber } = useAuth();

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

      const isVeryNarrow =
        width < 430;

      const availableHeight =
        height -
        insets.top -
        insets.bottom;

      const availableWidth =
        width -
        24;

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
        min = size * 0.65,
        max = size * 1.08
      ) => {
        return Math.round(
          clamp(size * base, min, max)
        );
      };

      const tabletLandscape =
        !isPhone && isLandscape;

      const phoneLandscape =
        isPhone && isLandscape;

      return {
        isPhone,
        isLandscape,
        tabletLandscape,
        phoneLandscape,

        safeTopExtra: 0,

        safeBottomExtra:
          Math.max(insets.bottom + 6, 12),

        overlayPaddingH:
          tabletLandscape
            ? 12
            : phoneLandscape
              ? 10
              : isPhone
                ? isVeryNarrow
                  ? 14
                  : 18
                : 24,

        overlayPaddingV:
          tabletLandscape
            ? 10
            : phoneLandscape
              ? 8
              : isPhone
                ? 12
                : 20,

        cardWidth:
          tabletLandscape
            ? '92%'
            : phoneLandscape
              ? '88%'
              : isPhone
                ? '94%'
                : '90%',

        cardMaxWidth:
          tabletLandscape
            ? availableWidth
            : phoneLandscape
              ? clamp(width * 0.88, 420, 760)
              : isPhone
                ? clamp(width - 28, 300, 430)
                : clamp(width * 0.9, 520, 1180),

        cardMinWidth:
          tabletLandscape
            ? width * 0.88
            : undefined,

        cardHeight:
          tabletLandscape
            ? availableHeight * 0.78
            : phoneLandscape
              ? availableHeight * 0.82
              : isPhone
                ? availableHeight * 0.8
                : availableHeight * 0.88,

        cardMaxHeight:
          availableHeight * 0.94,

        cardRadius:
          tabletLandscape
            ? 32
            : phoneLandscape
              ? 24
              : isPhone
                ? 28
                : 36,

        cardPaddingH:
          tabletLandscape
            ? clamp(width * 0.055, 52, 82)
            : phoneLandscape
              ? 26
              : isPhone
                ? isVeryNarrow
                  ? 20
                  : 26
                : 56,

        cardPaddingTop:
          tabletLandscape
            ? 30
            : phoneLandscape
              ? 14
              : isPhone
                ? isVeryNarrow
                  ? 22
                  : 28
                : 42,

        cardPaddingBottom:
          tabletLandscape
            ? 30
            : phoneLandscape
              ? 14
              : isPhone
                ? isVeryNarrow
                  ? 22
                  : 28
                : 46,

        logoCircle:
          tabletLandscape
            ? clamp(availableHeight * 0.2, 92, 125)
            : phoneLandscape
              ? clamp(availableHeight * 0.2, 64, 90)
              : isPhone
                ? isVeryNarrow
                  ? scale(104, 82, 110)
                  : scale(122, 92, 130)
                : scale(150, 100, 160),

        logoMargin:
          tabletLandscape
            ? 10
            : phoneLandscape
              ? 8
              : isPhone
                ? 12
                : 16,

        titleFont:
          tabletLandscape
            ? scale(52, 42, 58)
            : phoneLandscape
              ? scale(34, 28, 36)
              : isPhone
                ? isVeryNarrow
                  ? scale(34, 28, 36)
                  : scale(40, 32, 42)
                : scale(58, 34, 60),

        titleLine:
          tabletLandscape
            ? scale(60, 48, 66)
            : phoneLandscape
              ? scale(39, 32, 42)
              : isPhone
                ? isVeryNarrow
                  ? scale(42, 34, 44)
                  : scale(48, 38, 50)
                : scale(66, 40, 68),

        subtitleFont:
          tabletLandscape
            ? scale(26, 20, 28)
            : phoneLandscape
              ? scale(18, 15, 20)
              : isPhone
                ? isVeryNarrow
                  ? scale(18, 15, 19)
                  : scale(22, 17, 23)
                : scale(28, 18, 28),

        tableLabelFont:
          tabletLandscape
            ? scale(24, 18, 26)
            : phoneLandscape
              ? scale(17, 14, 18)
              : isPhone
                ? isVeryNarrow
                  ? scale(18, 15, 19)
                  : scale(21, 17, 22)
                : scale(26, 17, 26),

        tableNumberFont:
          tabletLandscape
            ? scale(58, 42, 64)
            : phoneLandscape
              ? scale(34, 28, 36)
              : isPhone
                ? isVeryNarrow
                  ? scale(34, 28, 36)
                  : scale(42, 32, 44)
                : scale(64, 36, 66),

        tapFont:
          tabletLandscape
            ? scale(22, 17, 24)
            : phoneLandscape
              ? scale(16, 13, 17)
              : isPhone
                ? isVeryNarrow
                  ? scale(17, 14, 18)
                  : scale(20, 16, 21)
                : scale(24, 16, 24),
      };
    }, [
      width,
      height,
      insets.top,
      insets.bottom,
    ]);

  const logoRadius =
    responsive.logoCircle / 2;

  const logoSize =
    responsive.logoCircle * 0.78;

  return (
    <ImageBackground
      source={require('../../assets/welcome-background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <View style={styles.backgroundTint}>
        <SafeAreaView
          style={styles.safeArea}
          edges={['top']}
        >
          <Pressable
            style={styles.screenPress}
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: 'Menu',
                  },
                ],
              })
            }
          >
            <View
              style={[
                styles.overlay,
                {
                  paddingHorizontal:
                    responsive.overlayPaddingH,
                  paddingTop:
                    responsive.overlayPaddingV +
                    responsive.safeTopExtra,
                  paddingBottom:
                    responsive.overlayPaddingV +
                    responsive.safeBottomExtra,
                },
              ]}
            >
              <View
                style={[
                  styles.card,
                  {
                    width:
                      responsive.cardWidth,
                    maxWidth:
                      responsive.cardMaxWidth,
                    minWidth:
                      responsive.cardMinWidth,
                    height:
                      responsive.cardHeight,
                    maxHeight:
                      responsive.cardMaxHeight,
                    borderRadius:
                      responsive.cardRadius,
                    paddingHorizontal:
                      responsive.cardPaddingH,
                    paddingTop:
                      responsive.cardPaddingTop,
                    paddingBottom:
                      responsive.cardPaddingBottom,
                  },
                ]}
              >
                <View
                  style={[
                    styles.logoCircle,
                    {
                      width:
                        responsive.logoCircle,
                      height:
                        responsive.logoCircle,
                      borderRadius:
                        logoRadius,
                      marginBottom:
                        responsive.logoMargin,
                    },
                  ]}
                >
                  <Image
                    source={require('../../assets/chefoppa_logo.png')}
                    style={[
                      styles.logo,
                      {
                        width:
                          logoSize,
                        height:
                          logoSize,
                      },
                    ]}
                    resizeMode="contain"
                  />
                </View>

                <View style={styles.content}>
                  <View style={styles.headerSection}>
                    <Text
                      style={[
                        styles.title,
                        {
                          fontSize:
                            responsive.titleFont,
                          lineHeight:
                            responsive.titleLine,
                        },
                      ]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                    >
                      Welcome to Chef Oppa
                    </Text>

                    <Text
                      style={[
                        styles.subtitle,
                        {
                          fontSize:
                            responsive.subtitleFont,
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.78}
                    >
                      Korean Restaurant
                    </Text>
                  </View>

                  <View style={styles.tableSection}>
                    <Text
                      style={[
                        styles.tableLabel,
                        {
                          fontSize:
                            responsive.tableLabelFont,
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      Your Table Number
                    </Text>

                    <Text
                      style={[
                        styles.tableNumber,
                        {
                          fontSize:
                            responsive.tableNumberFont,
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                    >
                      Table No. {tableNumber || user?.table_number || '-'}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.tapText,
                      {
                        fontSize:
                          responsive.tapFont,
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    Tap anywhere to start
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles =
  StyleSheet.create({
    background: {
      flex: 1,
    },

    backgroundTint: {
      flex: 1,
      backgroundColor:
        'rgba(120, 76, 48, 0.42)',
    },

    safeArea: {
      flex: 1,
      backgroundColor:
        'rgba(120, 76, 48, 0.42)',
    },

    screenPress: {
      flex: 1,
    },

    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    card: {
      backgroundColor:
        'rgba(245, 242, 237, 0.96)',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 4,
      overflow: 'hidden',
    },

    logoCircle: {
      backgroundColor:
        'rgba(255, 255, 255, 0.92)',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },

    logo: {},

    content: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'space-around',
    },

    headerSection: {
      alignItems: 'center',
      width: '100%',
    },

    title: {
      fontWeight: '900',
      color: '#1f1f1f',
      textAlign: 'center',
      width: '100%',
    },

    subtitle: {
      fontWeight: '800',
      color: '#6b6b6b',
      textAlign: 'center',
      width: '100%',
      marginTop: 6,
    },

    tableSection: {
      alignItems: 'center',
      width: '100%',
    },

    tableLabel: {
      fontWeight: '800',
      color: '#777',
      textAlign: 'center',
      width: '100%',
    },

    tableNumber: {
      fontWeight: '900',
      color: '#f68c45',
      textAlign: 'center',
      width: '100%',
      marginTop: 6,
    },

    tapText: {
      fontWeight: '800',
      color: '#555',
      textDecorationLine: 'underline',
      textAlign: 'center',
      width: '100%',
    },
  });