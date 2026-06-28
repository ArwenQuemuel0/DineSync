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
  ScrollView,
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

      const isLandscape =
        width > height;

      const isPhone =
        shortest < 600;

      const isVeryNarrow =
        width < 390;

      const availableHeight =
        height -
        insets.top -
        insets.bottom;

      const availableWidth =
        width -
        insets.left -
        insets.right;

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

      const tabletLandscape =
        !isPhone && isLandscape;

      const phoneLandscape =
        isPhone && isLandscape;

      const compactLandscape =
        isLandscape &&
        availableHeight < 430;

      const cardMaxWidth =
        tabletLandscape
          ? clamp(availableWidth * 0.88, 680, 1180)
          : phoneLandscape
            ? clamp(availableWidth * 0.88, 420, 760)
            : isPhone
              ? clamp(availableWidth - 28, 300, 430)
              : clamp(availableWidth * 0.9, 520, 1180);

      const cardMinHeight =
        tabletLandscape
          ? clamp(availableHeight * 0.68, 350, 520)
          : phoneLandscape
            ? clamp(availableHeight * 0.72, 270, 360)
            : isPhone
              ? clamp(availableHeight * 0.68, 460, 620)
              : clamp(availableHeight * 0.72, 560, 760);

      return {
        isPhone,
        isLandscape,
        tabletLandscape,
        phoneLandscape,
        compactLandscape,

        safeTopExtra: 0,

        safeBottomExtra:
          Math.max(insets.bottom + 8, 14),

        overlayPaddingH:
          tabletLandscape
            ? scale(18, 12, 24)
            : phoneLandscape
              ? scale(10, 8, 12)
              : isPhone
                ? isVeryNarrow
                  ? scale(14, 12, 16)
                  : scale(18, 14, 20)
                : scale(24, 18, 30),

        overlayPaddingV:
          tabletLandscape
            ? scale(14, 10, 18)
            : phoneLandscape
              ? scale(8, 6, 10)
              : isPhone
                ? scale(12, 10, 16)
                : scale(20, 16, 26),

        cardWidth:
          tabletLandscape
            ? '88%'
            : phoneLandscape
              ? '88%'
              : isPhone
                ? '94%'
                : '90%',

        cardMaxWidth,

        cardMinHeight,

        cardMaxHeight:
          Math.max(
            availableHeight * 0.94,
            280
          ),

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
            ? clamp(availableWidth * 0.05, 44, 82)
            : phoneLandscape
              ? clamp(availableWidth * 0.04, 22, 34)
              : isPhone
                ? isVeryNarrow
                  ? scale(20, 16, 22)
                  : scale(26, 20, 28)
                : clamp(availableWidth * 0.055, 42, 72),

        cardPaddingTop:
          tabletLandscape
            ? scale(30, 22, 36)
            : phoneLandscape
              ? scale(14, 10, 18)
              : isPhone
                ? isVeryNarrow
                  ? scale(22, 18, 26)
                  : scale(28, 22, 32)
                : scale(42, 32, 48),

        cardPaddingBottom:
          tabletLandscape
            ? scale(30, 22, 36)
            : phoneLandscape
              ? scale(14, 10, 18)
              : isPhone
                ? isVeryNarrow
                  ? scale(22, 18, 26)
                  : scale(28, 22, 32)
                : scale(46, 34, 52),

        logoCircle:
          tabletLandscape
            ? clamp(availableHeight * 0.2, 92, 125)
            : phoneLandscape
              ? clamp(availableHeight * 0.2, 64, 90)
              : isPhone
                ? isVeryNarrow
                  ? scale(104, 82, 112)
                  : scale(122, 92, 132)
                : scale(150, 110, 164),

        logoMargin:
          tabletLandscape
            ? scale(10, 8, 12)
            : phoneLandscape
              ? scale(8, 6, 10)
              : isPhone
                ? scale(12, 10, 14)
                : scale(16, 12, 18),

        titleFont:
          tabletLandscape
            ? scale(52, 42, 58)
            : phoneLandscape
              ? scale(34, 28, 36)
              : isPhone
                ? isVeryNarrow
                  ? scale(34, 28, 36)
                  : scale(40, 32, 42)
                : scale(58, 40, 60),

        titleLine:
          tabletLandscape
            ? scale(60, 48, 66)
            : phoneLandscape
              ? scale(39, 32, 42)
              : isPhone
                ? isVeryNarrow
                  ? scale(42, 34, 44)
                  : scale(48, 38, 50)
                : scale(66, 46, 68),

        subtitleFont:
          tabletLandscape
            ? scale(26, 20, 28)
            : phoneLandscape
              ? scale(18, 15, 20)
              : isPhone
                ? isVeryNarrow
                  ? scale(18, 15, 19)
                  : scale(22, 17, 23)
                : scale(28, 20, 30),

        tableLabelFont:
          tabletLandscape
            ? scale(24, 18, 26)
            : phoneLandscape
              ? scale(17, 14, 18)
              : isPhone
                ? isVeryNarrow
                  ? scale(18, 15, 19)
                  : scale(21, 17, 22)
                : scale(26, 18, 28),

        tableNumberFont:
          tabletLandscape
            ? scale(58, 42, 64)
            : phoneLandscape
              ? scale(34, 28, 36)
              : isPhone
                ? isVeryNarrow
                  ? scale(34, 28, 36)
                  : scale(42, 32, 44)
                : scale(64, 42, 68),

        tapFont:
          tabletLandscape
            ? scale(22, 17, 24)
            : phoneLandscape
              ? scale(16, 13, 17)
              : isPhone
                ? isVeryNarrow
                  ? scale(17, 14, 18)
                  : scale(20, 16, 21)
                : scale(24, 17, 26),
      };
    }, [
      width,
      height,
      insets.top,
      insets.left,
      insets.right,
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
          edges={[
            'top',
            'left',
            'right',
            'bottom',
          ]}
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
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[
                styles.scrollContent,
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
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View
                style={[
                  styles.card,
                  {
                    width:
                      responsive.cardWidth,
                    maxWidth:
                      responsive.cardMaxWidth,
                    minHeight:
                      responsive.cardMinHeight,
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
            </ScrollView>
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

    scrollView: {
      flex: 1,
      width: '100%',
    },

    scrollContent: {
      flexGrow: 1,
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
      minHeight: 0,
    },

    headerSection: {
      alignItems: 'center',
      width: '100%',
      flexShrink: 1,
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
      flexShrink: 1,
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