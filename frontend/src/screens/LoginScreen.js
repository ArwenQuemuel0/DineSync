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

      const longest =
        Math.max(width, height);

      const isLandscape =
        width > height;

      const isPhone =
        shortest < 600;

      const isSmallPhone =
        width < 390;

      const isShortHeight =
        height < 680;

      const isVeryShortHeight =
        height < 560;

      const availableHeight =
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
          ? Math.min(shortest / 390, 1)
          : Math.min(shortest / 768, 1.08);

      const scale = (
        size,
        min = size * 0.72,
        max = size * 1.12
      ) => {
        return Math.round(
          clamp(size * base, min, max)
        );
      };

      const phoneLandscape =
        isPhone && isLandscape;

      const compact =
        phoneLandscape ||
        isShortHeight;

      const ultraCompact =
        phoneLandscape ||
        isVeryShortHeight;

      const cardWidth =
        isPhone
          ? isLandscape
            ? '78%'
            : '92%'
          : isLandscape
            ? '90%'
            : '88%';

      const cardMaxWidth =
        isPhone
          ? isLandscape
            ? clamp(width * 0.74, 360, 520)
            : clamp(width - 28, 300, 410)
          : isLandscape
            ? clamp(width * 0.9, 1050, 1400)
            : clamp(width * 0.88, 760, 1080);

      const cardPaddingH =
        isPhone
          ? isLandscape
            ? clamp(width * 0.035, 18, 28)
            : clamp(width * 0.06, 20, 26)
          : isLandscape
            ? clamp(width * 0.055, 70, 96)
            : clamp(width * 0.075, 54, 86);

      const cardPaddingV =
        isPhone
          ? isLandscape
            ? clamp(availableHeight * 0.03, 10, 16)
            : clamp(availableHeight * 0.035, 20, 28)
          : isLandscape
            ? clamp(availableHeight * 0.055, 36, 56)
            : clamp(availableHeight * 0.06, 34, 54);

      const brandLogoSize =
        isPhone
          ? isLandscape
            ? clamp(availableHeight * 0.13, 44, 62)
            : clamp(width * 0.16, 56, 74)
          : isLandscape
            ? clamp(availableHeight * 0.2, 110, 145)
            : clamp(shortest * 0.14, 105, 150);

      const inputHeight =
        isPhone
          ? isLandscape
            ? clamp(availableHeight * 0.085, 38, 46)
            : clamp(availableHeight * 0.065, 46, 54)
          : isLandscape
            ? clamp(availableHeight * 0.105, 62, 74)
            : clamp(availableHeight * 0.078, 60, 72);

      const buttonHeight =
        isPhone
          ? isLandscape
            ? clamp(availableHeight * 0.09, 40, 48)
            : clamp(availableHeight * 0.068, 50, 58)
          : isLandscape
            ? clamp(availableHeight * 0.105, 66, 78)
            : clamp(availableHeight * 0.082, 64, 76);

      return {
        compact,
        ultraCompact,

        overlayPaddingH:
          isPhone
            ? isLandscape
              ? 10
              : 14
            : isLandscape
              ? 18
              : 24,

        overlayPaddingV:
          isPhone
            ? isLandscape
              ? 6
              : 10
            : isLandscape
              ? 14
              : 18,

        safeTopExtra:
          isPhone
            ? isLandscape
              ? 0
              : 4
            : 6,

        safeBottomExtra:
          Math.max(
            insets.bottom + 6,
            10
          ),

        cardWidth,

        cardMaxWidth,

        cardMaxHeight:
          Math.max(
            availableHeight -
              (isPhone ? 18 : 30),
            isPhone ? 280 : 520
          ),

        cardRadius:
          isPhone
            ? isLandscape
              ? 20
              : 24
            : isLandscape
              ? 34
              : 36,

        cardPaddingH,

        cardPaddingV,

        brandMargin:
          isPhone
            ? isLandscape
              ? 10
              : 16
            : isLandscape
              ? 26
              : 28,

        brandLogoSize,

        brandTitleFont:
          isPhone
            ? isLandscape
              ? clamp(width * 0.031, 17, 21)
              : isSmallPhone
                ? 20
                : 22
            : isLandscape
              ? 36
              : 36,

        brandPoweredFont:
          isPhone
            ? isLandscape
              ? 13
              : 14
            : isLandscape
              ? 21
              : 21,

        brandGap:
          isPhone
            ? isLandscape
              ? 5
              : 7
            : 10,

        formMaxWidth:
          isPhone
            ? '100%'
            : isLandscape
              ? clamp(width * 0.72, 860, 1040)
              : clamp(width * 0.72, 700, 920),

        labelFont:
          isPhone
            ? isLandscape
              ? 13
              : 15
            : isLandscape
              ? 21
              : 20,

        inputHeight,

        inputRadius:
          isPhone
            ? isLandscape
              ? 11
              : 13
            : 18,

        inputFont:
          isPhone
            ? isLandscape
              ? 13
              : 15
            : isLandscape
              ? 21
              : 20,

        inputPadding:
          isPhone
            ? isLandscape
              ? 12
              : 14
            : 22,

        inputMarginBottom:
          isPhone
            ? isLandscape
              ? 6
              : 10
            : isLandscape
              ? 16
              : 15,

        passwordMarginBottom:
          isPhone
            ? isLandscape
              ? 9
              : 16
            : isLandscape
              ? 30
              : 28,

        showButtonWidth:
          isPhone
            ? isLandscape
              ? 62
              : 72
            : isLandscape
              ? 118
              : 110,

        showButtonFont:
          isPhone
            ? isLandscape
              ? 11
              : 12
            : 18,

        buttonHeight,

        buttonRadius:
          isPhone
            ? isLandscape
              ? 11
              : 13
            : 18,

        buttonText:
          isPhone
            ? isLandscape
              ? 16
              : 18
            : isLandscape
              ? 28
              : 27,

        noteMargin:
          isPhone
            ? isLandscape
              ? 7
              : 13
            : isLandscape
              ? 24
              : 22,

        noteFont:
          isPhone
            ? isLandscape
              ? 10
              : 12
            : 18,

        noteLine:
          isPhone
            ? isLandscape
              ? 14
              : 18
            : 25,

        noteLines:
          ultraCompact
            ? 1
            : compact
              ? 2
              : undefined,
      };
    }, [
      width,
      height,
      insets.top,
      insets.bottom,
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
          ]}
        >
          <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={
              Platform.OS === 'ios'
                ? 'padding'
                : undefined
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
                    responsive.safeBottomExtra +
                    responsive.overlayPaddingV,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[
                  styles.card,
                  {
                    width:
                      responsive.cardWidth,
                    maxWidth:
                      responsive.cardMaxWidth,
                    maxHeight:
                      responsive.cardMaxHeight,
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
                  >
                    Login using the assigned table account. The table number will be detected automatically.
                  </Text>
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
      justifyContent: 'center',
      alignItems: 'center',
    },

    card: {
      backgroundColor:
        'rgba(245, 242, 237, 0.96)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },

    brandBlock: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },

    brandLogo: {},

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
    },

    label: {
      fontWeight: '900',
      color: '#555',
      marginBottom: 7,
      marginTop: 5,
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
    },

    showButton: {
      borderLeftWidth: 1,
      borderLeftColor: '#dfd6cf',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f7f2ef',
    },

    showButtonText: {
      color: '#f68c45',
      fontWeight: '900',
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
    },

    note: {
      color: '#555',
      textAlign: 'center',
      fontWeight: '800',
      alignSelf: 'center',
      maxWidth: 760,
    },
  });