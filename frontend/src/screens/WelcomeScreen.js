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

      const logoCircle =
        isVeryNarrow
          ? scale(104, 82, 110)
          : isPhone
            ? scale(122, 92, 130)
            : scale(150, 100, 160);

      const availableHeight =
        height -
        insets.top -
        insets.bottom;

      return {
        isPhone,
        isVeryNarrow,

        safeTopExtra:
          isPhone
            ? 8
            : 10,

        safeBottomExtra:
          Math.max(insets.bottom + 10, 18),

        overlayPaddingH:
          isVeryNarrow
            ? scale(14, 12, 16)
            : isPhone
              ? scale(18, 14, 20)
              : scale(26, 16, 30),

        overlayPaddingV:
          isPhone
            ? scale(14, 12, 18)
            : scale(24, 14, 28),

        cardWidth:
          isPhone
            ? '94%'
            : '94%',

        cardMaxWidth:
          isPhone
            ? clamp(width - 28, 300, 430)
            : clamp(longest * 0.9, 420, 1320),

        cardHeight:
          isPhone
            ? availableHeight * 0.76
            : availableHeight * 0.82,

        cardMaxHeight:
          availableHeight * 0.9,

        cardRadius:
          isPhone
            ? scale(28, 20, 30)
            : scale(36, 22, 38),

        cardPaddingH:
          isVeryNarrow
            ? scale(20, 16, 22)
            : isPhone
              ? scale(26, 20, 30)
              : scale(56, 24, 58),

        cardPaddingTop:
          isVeryNarrow
            ? scale(24, 18, 26)
            : isPhone
              ? scale(30, 22, 34)
              : scale(44, 22, 46),

        cardPaddingBottom:
          isVeryNarrow
            ? scale(24, 18, 26)
            : isPhone
              ? scale(30, 22, 34)
              : scale(48, 24, 50),

        logoCircle,

        logoRadius:
          logoCircle / 2,

        logoSize:
          logoCircle * 0.78,

        logoMargin:
          isPhone
            ? scale(12, 8, 14)
            : scale(16, 8, 16),

        titleFont:
          isVeryNarrow
            ? scale(34, 28, 36)
            : isPhone
              ? scale(40, 32, 42)
              : scale(58, 34, 60),

        titleLine:
          isVeryNarrow
            ? scale(42, 34, 44)
            : isPhone
              ? scale(48, 38, 50)
              : scale(66, 40, 68),

        subtitleFont:
          isVeryNarrow
            ? scale(18, 15, 19)
            : isPhone
              ? scale(22, 17, 23)
              : scale(28, 18, 28),

        subtitleMargin:
          scale(8, 4, 8),

        tableLabelFont:
          isVeryNarrow
            ? scale(18, 15, 19)
            : isPhone
              ? scale(21, 17, 22)
              : scale(26, 17, 26),

        tableNumberFont:
          isVeryNarrow
            ? scale(34, 28, 36)
            : isPhone
              ? scale(42, 32, 44)
              : scale(64, 36, 66),

        tableNumberMargin:
          scale(8, 4, 8),

        tapFont:
          isVeryNarrow
            ? scale(17, 14, 18)
            : isPhone
              ? scale(20, 16, 21)
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

      <SafeAreaView
        style={styles.safeArea}
        edges={[
          'top',
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
    </ImageBackground>
  );
}

const styles =
  StyleSheet.create({
    background: {
      flex: 1,
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
      backgroundColor:
        'rgba(120, 76, 48, 0.42)',
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
    },

    logoCircle: {
      backgroundColor:
        'rgba(255, 255, 255, 0.92)',
      justifyContent: 'center',
      alignItems: 'center',
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