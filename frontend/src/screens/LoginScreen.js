import React, {
  useMemo,
  useState,
} from 'react';

import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
  useWindowDimensions,
  ScrollView,
  StatusBar,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';

export default function LoginScreen({
  navigation,
}) {
  const { login } = useAuth();

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

      const isPhoneLandscape =
        isPhone && isLandscape;

      const isTabletLandscape =
        !isPhone && isLandscape;

      const isVeryNarrow =
        width < 380;

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

      const overlayPaddingH =
        isTabletLandscape
          ? clamp(availableWidth * 0.035, 18, 38)
          : isPhoneLandscape
            ? 10
            : isPhone
              ? isVeryNarrow
                ? 10
                : 14
              : 24;

      const overlayPaddingV =
        isTabletLandscape
          ? clamp(availableHeight * 0.035, 12, 24)
          : isPhoneLandscape
            ? 8
            : isPhone
              ? 14
              : 22;

      const safeBottomExtra =
        isLandscape
          ? Math.max(
            insets.bottom + 6,
            10
          )
          : Math.max(
            insets.bottom + 10,
            14
          );

      const cardMaxWidth =
        isTabletLandscape
          ? clamp(availableWidth * 0.78, 620, 980)
          : isPhoneLandscape
            ? clamp(availableWidth * 0.78, 430, 720)
            : isPhone
              ? Math.min(
                availableWidth - 24,
                430
              )
              : clamp(availableWidth * 0.82, 560, 900);

      const cardWidth =
        isPhone
          ? '94%'
          : isTabletLandscape
            ? '78%'
            : '86%';

      const cardPaddingH =
        isTabletLandscape
          ? clamp(availableWidth * 0.05, 42, 78)
          : isPhoneLandscape
            ? clamp(availableWidth * 0.04, 22, 34)
            : isPhone
              ? clamp(availableWidth * 0.055, 16, 24)
              : clamp(availableWidth * 0.055, 34, 72);

      const cardPaddingV =
        isTabletLandscape
          ? clamp(availableHeight * 0.04, 18, 32)
          : isPhoneLandscape
            ? clamp(availableHeight * 0.035, 12, 18)
            : isPhone
              ? clamp(availableHeight * 0.035, 18, 28)
              : clamp(availableHeight * 0.055, 30, 52);

      return {
        screenMinHeight:
          Math.max(
            availableHeight,
            height -
            insets.top -
            insets.bottom
          ),

        overlayPaddingH,
        overlayPaddingV,
        safeBottomExtra,

        cardWidth,
        cardMaxWidth,

        cardRadius:
          isLandscape
            ? 24
            : isPhone
              ? 24
              : 34,

        cardPaddingH,
        cardPaddingV,

        brandMargin:
          isTabletLandscape
            ? 14
            : isPhoneLandscape
              ? 8
              : isPhone
                ? 14
                : 24,

        brandLogoSize:
          isTabletLandscape
            ? clamp(availableHeight * 0.16, 70, 105)
            : isPhoneLandscape
              ? clamp(availableHeight * 0.13, 42, 58)
              : isPhone
                ? clamp(availableWidth * 0.16, 50, 74)
                : clamp(shortest * 0.13, 82, 132),

        brandTitleFont:
          isTabletLandscape
            ? scale(30, 24, 34)
            : isPhoneLandscape
              ? scale(18, 15, 20)
              : isPhone
                ? scale(22, 18, 24)
                : scale(34, 26, 36),

        brandPoweredFont:
          isTabletLandscape
            ? scale(18, 15, 20)
            : isPhoneLandscape
              ? scale(12, 10, 13)
              : isPhone
                ? scale(14, 12, 15)
                : scale(20, 16, 21),

        brandGap:
          isLandscape
            ? 5
            : isPhone
              ? 6
              : 9,

        formMaxWidth:
          isTabletLandscape
            ? clamp(availableWidth * 0.62, 560, 760)
            : isPhoneLandscape
              ? clamp(availableWidth * 0.68, 420, 620)
              : isPhone
                ? '100%'
                : clamp(availableWidth * 0.68, 520, 760),

        labelFont:
          isTabletLandscape
            ? scale(18, 15, 20)
            : isPhoneLandscape
              ? scale(13, 12, 14)
              : isPhone
                ? scale(15, 13, 16)
                : scale(20, 16, 21),

        inputHeight:
          isTabletLandscape
            ? clamp(availableHeight * 0.085, 50, 64)
            : isPhoneLandscape
              ? clamp(availableHeight * 0.09, 38, 46)
              : isPhone
                ? clamp(availableHeight * 0.065, 44, 54)
                : clamp(availableHeight * 0.072, 54, 68),

        inputRadius:
          isLandscape
            ? 13
            : isPhone
              ? 13
              : 17,

        inputFont:
          isTabletLandscape
            ? scale(18, 15, 20)
            : isPhoneLandscape
              ? scale(13, 12, 14)
              : isPhone
                ? scale(15, 13, 16)
                : scale(20, 16, 21),

        inputPadding:
          isTabletLandscape
            ? 18
            : isPhoneLandscape
              ? 13
              : isPhone
                ? 14
                : 20,

        inputMarginBottom:
          isTabletLandscape
            ? 11
            : isPhoneLandscape
              ? 7
              : isPhone
                ? 10
                : 14,

        passwordMarginBottom:
          isTabletLandscape
            ? 18
            : isPhoneLandscape
              ? 10
              : isPhone
                ? 16
                : 26,

        showButtonWidth:
          isTabletLandscape
            ? 100
            : isPhoneLandscape
              ? 68
              : isPhone
                ? 72
                : 105,

        showButtonFont:
          isTabletLandscape
            ? scale(16, 13, 17)
            : isPhoneLandscape
              ? scale(11, 10, 12)
              : isPhone
                ? scale(12, 11, 13)
                : scale(17, 14, 18),

        buttonHeight:
          isTabletLandscape
            ? clamp(availableHeight * 0.085, 52, 66)
            : isPhoneLandscape
              ? clamp(availableHeight * 0.092, 40, 48)
              : isPhone
                ? clamp(availableHeight * 0.068, 48, 56)
                : clamp(availableHeight * 0.078, 58, 72),

        buttonRadius:
          isLandscape
            ? 13
            : isPhone
              ? 13
              : 17,

        buttonText:
          isTabletLandscape
            ? scale(24, 18, 26)
            : isPhoneLandscape
              ? scale(16, 14, 17)
              : isPhone
                ? scale(18, 16, 19)
                : scale(26, 20, 27),

        noteMargin:
          isTabletLandscape
            ? 14
            : isPhoneLandscape
              ? 8
              : isPhone
                ? 14
                : 22,

        noteFont:
          isTabletLandscape
            ? scale(15, 13, 17)
            : isPhoneLandscape
              ? scale(10, 9, 11)
              : isPhone
                ? scale(12, 11, 13)
                : scale(17, 14, 18),

        noteLine:
          isTabletLandscape
            ? scale(21, 18, 23)
            : isPhoneLandscape
              ? scale(14, 12, 15)
              : isPhone
                ? scale(18, 16, 19)
                : scale(24, 20, 25),

        noteLines:
          isLandscape
            ? 1
            : isPhone
              ? 2
              : 3,
      };
    }, [
      width,
      height,
      insets.top,
      insets.bottom,
      insets.left,
      insets.right,
    ]);

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(
        'Missing Details',
        'Please enter email and password.'
      );

      return;
    }

    setLoading(true);

    const result =
      await login(
        email.trim(),
        password
      );

    setLoading(false);

    if (!result.success) {
      Alert.alert(
        'Login Failed',
        result.message
      );

      return;
    }

    navigation.replace('Welcome');
  };

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
            'bottom',
            'left',
            'right',
          ]}
        >
          <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={
              Platform.OS === 'ios'
                ? 'padding'
                : 'height'
            }
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[
                styles.scrollContent,
                {
                  minHeight:
                    responsive.screenMinHeight,
                  paddingHorizontal:
                    responsive.overlayPaddingH,
                  paddingTop:
                    responsive.overlayPaddingV,
                  paddingBottom:
                    responsive.safeBottomExtra +
                    responsive.overlayPaddingV,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View
                style={[
                  styles.centerWrap,
                  {
                    minHeight:
                      responsive.screenMinHeight -
                      (
                        responsive.overlayPaddingV * 2
                      ),
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
                      borderRadius:
                        responsive.cardRadius,
                      paddingHorizontal:
                        responsive.cardPaddingH,
                      paddingVertical:
                        responsive.cardPaddingV,
                    },
                  ]}
                >
                  <View
                    style={styles.innerCardContent}
                  >
                    <View
                      style={[
                        styles.brandBlock,
                        {
                          marginBottom:
                            responsive.brandMargin,
                          gap:
                            responsive.brandGap,
                        },
                      ]}
                    >
                      <Image
                        source={require('../../assets/chefoppa_logo.png')}
                        style={[
                          styles.brandLogo,
                          {
                            width:
                              responsive.brandLogoSize,
                            height:
                              responsive.brandLogoSize,
                          },
                        ]}
                        resizeMode="contain"
                      />

                      <Text
                        style={[
                          styles.brandTitle,
                          {
                            fontSize:
                              responsive.brandTitleFont,
                          },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                      >
                        Chef Oppa Korean Restaurant
                      </Text>

                      <Text
                        style={[
                          styles.poweredText,
                          {
                            fontSize:
                              responsive.brandPoweredFont,
                          },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Powered by DineSync+
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.form,
                        {
                          maxWidth:
                            responsive.formMaxWidth,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.label,
                          {
                            fontSize:
                              responsive.labelFont,
                          },
                        ]}
                      >
                        Email
                      </Text>

                      <TextInput
                        style={[
                          styles.input,
                          {
                            height:
                              responsive.inputHeight,
                            borderRadius:
                              responsive.inputRadius,
                            paddingHorizontal:
                              responsive.inputPadding,
                            fontSize:
                              responsive.inputFont,
                            marginBottom:
                              responsive.inputMarginBottom,
                          },
                        ]}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        placeholder="Enter table email"
                        placeholderTextColor="#999"
                      />

                      <Text
                        style={[
                          styles.label,
                          {
                            fontSize:
                              responsive.labelFont,
                          },
                        ]}
                      >
                        Password
                      </Text>

                      <View
                        style={[
                          styles.passwordRow,
                          {
                            height:
                              responsive.inputHeight,
                            borderRadius:
                              responsive.inputRadius,
                            marginBottom:
                              responsive.passwordMarginBottom,
                          },
                        ]}
                      >
                        <TextInput
                          style={[
                            styles.passwordInput,
                            {
                              paddingHorizontal:
                                responsive.inputPadding,
                              fontSize:
                                responsive.inputFont,
                            },
                          ]}
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                          placeholder="Enter password"
                          placeholderTextColor="#999"
                        />

                        <Pressable
                          style={[
                            styles.showButton,
                            {
                              width:
                                responsive.showButtonWidth,
                            },
                          ]}
                          onPress={() =>
                            setShowPassword(
                              !showPassword
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.showButtonText,
                              {
                                fontSize:
                                  responsive.showButtonFont,
                              },
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {showPassword
                              ? 'Hide'
                              : 'Show'}
                          </Text>
                        </Pressable>
                      </View>

                      <Pressable
                        style={[
                          styles.button,
                          {
                            height:
                              responsive.buttonHeight,
                            borderRadius:
                              responsive.buttonRadius,
                          },
                          loading &&
                          styles.buttonDisabled,
                        ]}
                        onPress={handleLogin}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text
                            style={[
                              styles.buttonText,
                              {
                                fontSize:
                                  responsive.buttonText,
                              },
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            Login
                          </Text>
                        )}
                      </Pressable>

                      <Text
                        style={[
                          styles.note,
                          {
                            marginTop:
                              responsive.noteMargin,
                            fontSize:
                              responsive.noteFont,
                            lineHeight:
                              responsive.noteLine,
                          },
                        ]}
                        numberOfLines={
                          responsive.noteLines
                        }
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        Login using the assigned table account. The table number will be detected automatically.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
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
    },

    keyboardView: {
      flex: 1,
      width: '100%',
    },

    scrollView: {
      flex: 1,
      width: '100%',
    },

    scrollContent: {
      flexGrow: 1,
    },

    centerWrap: {
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },

    card: {
      backgroundColor:
        'rgba(245, 242, 237, 0.96)',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      overflow: 'visible',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 4,
    },

    innerCardContent: {
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },

    brandBlock: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 1,
    },

    brandLogo: {
      flexShrink: 0,
    },

    brandTitle: {
      width: '100%',
      color: '#1f1f1f',
      fontWeight: '900',
      textAlign: 'center',
    },

    poweredText: {
      width: '100%',
      color: '#1f1f1f',
      fontWeight: '900',
      fontStyle: 'italic',
      textAlign: 'center',
      opacity: 0.45,
    },

    form: {
      width: '100%',
      alignSelf: 'center',
    },

    label: {
      fontWeight: '900',
      color: '#555',
      marginBottom: 5,
      marginTop: 3,
    },

    input: {
      width: '100%',
      backgroundColor: '#fff',
      fontWeight: '700',
      borderWidth: 1.5,
      borderColor: '#dfd6cf',
      color: '#222',
    },

    passwordRow: {
      width: '100%',
      flexDirection: 'row',
      backgroundColor: '#fff',
      borderWidth: 1.5,
      borderColor: '#dfd6cf',
      overflow: 'hidden',
    },

    passwordInput: {
      flex: 1,
      fontWeight: '700',
      color: '#222',
      minWidth: 0,
    },

    showButton: {
      borderLeftWidth: 1,
      borderLeftColor: '#dfd6cf',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f7f2ef',
      flexShrink: 0,
    },

    showButtonText: {
      color: '#f68c45',
      fontWeight: '900',
      textAlign: 'center',
    },

    button: {
      width: '100%',
      backgroundColor: '#f68c45',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },

    buttonDisabled: {
      opacity: 0.75,
    },

    buttonText: {
      color: '#fff',
      fontWeight: '900',
      textAlign: 'center',
    },

    note: {
      color: '#555',
      textAlign: 'center',
      fontWeight: '800',
      alignSelf: 'center',
      maxWidth: 760,
    },
  });