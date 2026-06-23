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

      const logoCircle =
        isVeryNarrow
          ? scale(94, 72, 98)
          : isPhone
            ? scale(108, 82, 112)
            : scale(130, 90, 136);

      const inputHeight =
        isPhone
          ? scale(54, 46, 56)
          : scale(58, 48, 60);

      const buttonHeight =
        isPhone
          ? scale(58, 50, 60)
          : scale(66, 54, 68);

      const cardWidth =
        isPhone
          ? '94%'
          : '88%';

      const cardMaxWidth =
        isPhone
          ? clamp(width - 28, 300, 430)
          : clamp(longest * 0.82, 420, 950);

      const cardMaxHeight =
        height -
        insets.top -
        insets.bottom -
        28;

      return {
        isPhone,
        isVeryNarrow,
        isLandscape,

        overlayPaddingH:
          isVeryNarrow
            ? scale(14, 12, 16)
            : isPhone
              ? scale(18, 14, 20)
              : scale(32, 18, 34),

        overlayPaddingV:
          isPhone
            ? scale(12, 10, 16)
            : scale(24, 14, 26),

        safeTopExtra:
          isPhone
            ? 6
            : 8,

        safeBottomExtra:
          Math.max(insets.bottom + 8, 14),

        cardWidth,

        cardMaxWidth,

        cardMaxHeight,

        cardRadius:
          isPhone
            ? scale(26, 20, 28)
            : scale(34, 22, 36),

        cardPaddingH:
          isVeryNarrow
            ? scale(20, 16, 22)
            : isPhone
              ? scale(24, 20, 28)
              : scale(60, 26, 60),

        cardPaddingV:
          isVeryNarrow
            ? scale(22, 18, 24)
            : isPhone
              ? scale(26, 20, 30)
              : scale(38, 24, 40),

        logoCircle,

        logoRadius:
          logoCircle / 2,

        logoSize:
          logoCircle * 0.78,

        logoMargin:
          isPhone
            ? scale(14, 10, 16)
            : scale(22, 12, 22),

        titleFont:
          isVeryNarrow
            ? scale(29, 24, 30)
            : isPhone
              ? scale(33, 26, 34)
              : scale(44, 30, 44),

        subtitleFont:
          isVeryNarrow
            ? scale(17, 15, 18)
            : isPhone
              ? scale(19, 16, 20)
              : scale(25, 18, 25),

        subtitleMargin:
          isPhone
            ? scale(16, 12, 18)
            : scale(22, 14, 22),

        formMaxWidth:
          isPhone
            ? '100%'
            : clamp(width * 0.72, 320, 520),

        labelFont:
          scale(18, 13, 18),

        inputHeight,

        inputRadius:
          scale(14, 10, 14),

        inputFont:
          scale(18, 14, 18),

        inputPadding:
          scale(18, 12, 18),

        inputMarginBottom:
          isPhone
            ? scale(12, 9, 13)
            : scale(14, 10, 14),

        passwordMarginBottom:
          isPhone
            ? scale(20, 15, 22)
            : scale(28, 18, 28),

        showButtonWidth:
          isVeryNarrow
            ? scale(76, 66, 78)
            : scale(95, 72, 95),

        showButtonFont:
          scale(16, 12, 16),

        buttonHeight,

        buttonRadius:
          scale(15, 11, 15),

        buttonText:
          scale(24, 17, 24),

        noteMargin:
          isPhone
            ? scale(16, 12, 18)
            : scale(22, 14, 22),

        noteFont:
          scale(15, 12, 15),

        noteLine:
          scale(22, 17, 22),
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
                : 'height'
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

                <Text
                  style={[
                    styles.title,
                    {
                      fontSize:
                        responsive.titleFont,
                    },
                  ]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  DineSync Tablet Login
                </Text>

                <Text
                  style={[
                    styles.subtitle,
                    {
                      fontSize:
                        responsive.subtitleFont,
                      marginBottom:
                        responsive.subtitleMargin,
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  Chef Oppa Korean Restaurant
                </Text>

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
    },

    logoCircle: {
      backgroundColor:
        'rgba(255, 255, 255, 0.94)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    logo: {},

    title: {
      fontWeight: '900',
      color: '#1f1f1f',
      textAlign: 'center',
      marginBottom: 8,
      width: '100%',
    },

    subtitle: {
      fontWeight: '900',
      color: '#666',
      textAlign: 'center',
      width: '100%',
    },

    form: {
      width: '100%',
    },

    label: {
      fontWeight: '900',
      color: '#555',
      marginBottom: 8,
      marginTop: 8,
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
      maxWidth: 500,
    },
  });