import React, {
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
  } from 'react-native';
  
  import { useAuth } from '../context/AuthContext';
  
  export default function LoginScreen({
    navigation,
  }) {
    const { login } = useAuth();
  
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
        source={require('../../assets/welcome-background.avif')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={
              Platform.OS === 'ios'
                ? 'padding'
                : undefined
            }
          >
            <View style={styles.card}>
              <View style={styles.logoCircle}>
                <Image
                  source={require('../../assets/chefoppa_logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
  
              <Text style={styles.title}>
                DineSync Tablet Login
              </Text>
  
              <Text style={styles.subtitle}>
                Chef Oppa Korean Restaurant
              </Text>
  
              <View style={styles.form}>
                <Text style={styles.label}>
                  Email
                </Text>
  
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="Enter table email"
                  placeholderTextColor="#999"
                />
  
                <Text style={styles.label}>
                  Password
                </Text>
  
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Enter password"
                    placeholderTextColor="#999"
                  />
  
                  <Pressable
                    style={styles.showButton}
                    onPress={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                  >
                    <Text style={styles.showButtonText}>
                      {showPassword
                        ? 'Hide'
                        : 'Show'}
                    </Text>
                  </Pressable>
                </View>
  
                <Pressable
                  style={[
                    styles.button,
                    loading &&
                      styles.buttonDisabled,
                  ]}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>
                      Login
                    </Text>
                  )}
                </Pressable>
  
                <Text style={styles.note}>
                  Login using the assigned table account. The table number will be detected automatically.
                </Text>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </ImageBackground>
    );
  }
  
  const styles =
    StyleSheet.create({
      background: {
        flex: 1,
      },
  
      overlay: {
        flex: 1,
        backgroundColor:
          'rgba(120, 76, 48, 0.42)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingVertical: 24,
      },
  
      keyboardView: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      },
  
      card: {
        width: '88%',
        maxWidth: 950,
        minHeight: 620,
        backgroundColor:
          'rgba(245, 242, 237, 0.96)',
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 60,
        paddingVertical: 38,
      },
  
      logoCircle: {
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor:
          'rgba(255, 255, 255, 0.94)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 22,
      },
  
      logo: {
        width: 102,
        height: 102,
      },
  
      title: {
        fontSize: 44,
        fontWeight: '900',
        color: '#1f1f1f',
        textAlign: 'center',
        marginBottom: 8,
      },
  
      subtitle: {
        fontSize: 25,
        fontWeight: '900',
        color: '#666',
        textAlign: 'center',
        marginBottom: 22,
      },
  
      form: {
        width: '100%',
        maxWidth: 520,
      },
  
      label: {
        fontSize: 18,
        fontWeight: '900',
        color: '#555',
        marginBottom: 8,
        marginTop: 8,
      },
  
      input: {
        width: '100%',
        height: 58,
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingHorizontal: 18,
        fontSize: 18,
        fontWeight: '700',
        borderWidth: 1.5,
        borderColor: '#dfd6cf',
        color: '#222',
        marginBottom: 14,
      },
  
      passwordRow: {
        width: '100%',
        height: 58,
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#dfd6cf',
        overflow: 'hidden',
        marginBottom: 28,
      },
  
      passwordInput: {
        flex: 1,
        paddingHorizontal: 18,
        fontSize: 18,
        fontWeight: '700',
        color: '#222',
      },
  
      showButton: {
        width: 95,
        borderLeftWidth: 1,
        borderLeftColor: '#dfd6cf',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f7f2ef',
      },
  
      showButtonText: {
        color: '#f68c45',
        fontSize: 16,
        fontWeight: '900',
      },
  
      button: {
        width: '100%',
        height: 66,
        backgroundColor: '#f68c45',
        borderRadius: 15,
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
        fontSize: 24,
        fontWeight: '900',
      },
  
      note: {
        marginTop: 22,
        fontSize: 15,
        color: '#555',
        textAlign: 'center',
        fontWeight: '800',
        lineHeight: 22,
        alignSelf: 'center',
        maxWidth: 500,
      },
    });