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

      const longest =
        Math.max(width, height);

      const isPhone =
        shortest < 600;

      const isVeryNarrow =
        width < 430;

      const isLandscape =
        width > height;

      const isShortHeight =
        height < 650;

      const availableHeight =
        height -
        insets.top -
        insets.bottom;

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

      const compact =
        isPhone ||
        isShortHeight;

      const logoCircle =
        isPhone
          ? isLandscape
            ? clamp(availableHeight * 0.18, 62, 88)
            : isVeryNarrow
              ? scale(104, 82, 110)
              : scale(122, 92, 130)
          : isLandscape
            ? scale(132, 92, 145)
            : scale(150, 100, 160);

      const cardHeight =
        isPhone
          ? isLandscape
            ? availableHeight * 0.86
            : availableHeight * 0.8
          : isLandscape
            ? availableHeight * 0.90
            : availableHeight * 0.88;

      return {
        isPhone,
        isVeryNarrow,
        isLandscape,
        compact,

        safeTopExtra: 0,

        safeBottomExtra:
          Math.max(insets.bottom + 6, 12),

        overlayPaddingH:
          isVeryNarrow
            ? scale(14, 12, 16)
            : isPhone
              ? scale(18, 14, 20)
              : scale(26, 16, 30),

        overlayPaddingV:
          isPhone
            ? isLandscape
              ? scale(8, 6, 10)
              : scale(12, 10, 14)
            : scale(20, 12, 24),

        cardWidth:
          isPhone
            ? isLandscape
              ? '76%'
              : '94%'
            : '94%',

        cardMaxWidth:
          isPhone
            ? isLandscape
              ? clamp(width * 0.74, 360, 560)
              : clamp(width - 28, 300, 430)
            : clamp(longest * 0.9, 420, 1320),

        cardHeight,

        cardMaxHeight:
          availableHeight * 0.94,

        cardRadius:
          isPhone
            ? isLandscape
              ? scale(24, 18, 26)
              : scale(28, 20, 30)
            : scale(36, 22, 38),

        cardPaddingH:
          isVeryNarrow
            ? scale(20, 16, 22)
            : isPhone
              ? isLandscape
                ? scale(24, 18, 28)
                : scale(26, 20, 30)
              : scale(56, 24, 58),

        cardPaddingTop:
          isPhone
            ? isLandscape
              ? scale(16, 12, 20)
              : isVeryNarrow
                ? scale(22, 18, 24)
                : scale(28, 20, 32)
            : scale(42, 22, 46),

        cardPaddingBottom:
          isPhone
            ? isLandscape
              ? scale(16, 12, 20)
              : isVeryNarrow
                ? scale(22, 18, 24)
                : scale(28, 20, 32)
            : scale(46, 24, 50),

        logoCircle,

        logoRadius:
          logoCircle / 2,

        logoSize:
          logoCircle * 0.78,

        logoMargin:
          isPhone
            ? isLandscape
              ? scale(8, 5, 10)
              : scale(12, 8, 14)
            : scale(16, 8, 16),

        titleFont:
          isPhone
            ? isLandscape
              ? scale(32, 26, 34)
              : isVeryNarrow
                ? scale(34, 28, 36)
                : scale(40, 32, 42)
            : scale(58, 34, 60),

        titleLine:
          isPhone
            ? isLandscape
              ? scale(38, 30, 40)
              : isVeryNarrow
                ? scale(42, 34, 44)
                : scale(48, 38, 50)
            : scale(66, 40, 68),

        subtitleFont:
          isPhone
            ? isLandscape
              ? scale(18, 15, 19)
              : isVeryNarrow
                ? scale(18, 15, 19)
                : scale(22, 17, 23)
            : scale(28, 18, 28),

        subtitleMargin:
          scale(8, 4, 8),

        tableLabelFont:
          isPhone
            ? isLandscape
              ? scale(17, 14, 18)
              : isVeryNarrow
                ? scale(18, 15, 19)
                : scale(21, 17, 22)
            : scale(26, 17, 26),

        tableNumberFont:
          isPhone
            ? isLandscape
              ? scale(32, 26, 34)
              : isVeryNarrow
                ? scale(34, 28, 36)
                : scale(42, 32, 44)
            : scale(64, 36, 66),

        tableNumberMargin:
          scale(8, 4, 8),

        tapFont:
          isPhone
            ? isLandscape
              ? scale(16, 13, 17)
              : isVeryNarrow
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
                        responsive.logoRadius,
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
                          responsive.logoSize,
                        height:
                          responsive.logoSize,
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
                    >
                      Welcome to Chef Oppa
                    </Text>

                    <Text
                      style={[
                        styles.subtitle,
                        {
                          fontSize:
                            responsive.subtitleFont,
                          marginTop:
                            responsive.subtitleMargin,
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
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
                          marginTop:
                            responsive.tableNumberMargin,
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
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
    },

    tapText: {
      fontWeight: '800',
      color: '#555',
      textDecorationLine: 'underline',
      textAlign: 'center',
      width: '100%',
    },
  });