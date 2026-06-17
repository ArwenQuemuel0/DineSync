import React from 'react';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ImageBackground,
  StatusBar,
} from 'react-native';

import { useAuth } from '../context/AuthContext';

export default function WelcomeScreen({
  navigation,
}) {
  const { user, tableNumber } = useAuth();

  return (
    <ImageBackground
      source={require('../../assets/welcome-background.avif')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar hidden />

      <Pressable
        style={styles.screenPress}
        onPress={() =>
          navigation.reset({
            index: 0,
            routes: [{ name: 'Menu' }],
          })
        }
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.logoCircle}>
              <Image
                source={require('../../assets/chefoppa_logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.content}>
              <View style={styles.headerSection}>
                <Text style={styles.title}>
                  Welcome to Chef Oppa
                </Text>

                <Text style={styles.subtitle}>
                  Korean Restaurant
                </Text>
              </View>

              <View style={styles.tableSection}>
                <Text style={styles.tableLabel}>
                  Your Table Number
                </Text>

                <Text style={styles.tableNumber}>
                  Table No. {tableNumber || user?.table_number || '-'}
                </Text>
              </View>

              <Text style={styles.tapText}>
                Tap anywhere to start
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
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
    paddingHorizontal: 26,
    paddingVertical: 24,
  },

  card: {
    width: '94%',
    maxWidth: 1320,
    height: '82%',
    backgroundColor:
      'rgba(245, 242, 237, 0.96)',
    borderRadius: 36,
    alignItems: 'center',
    paddingHorizontal: 56,
    paddingTop: 44,
    paddingBottom: 48,
  },

  logoCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor:
      'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  logo: {
    width: 116,
    height: 116,
  },

  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  headerSection: {
    alignItems: 'center',
  },

  title: {
    fontSize: 58,
    fontWeight: '900',
    color: '#1f1f1f',
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '800',
    color: '#6b6b6b',
    textAlign: 'center',
  },

  tableSection: {
    alignItems: 'center',
  },

  tableLabel: {
    fontSize: 26,
    fontWeight: '800',
    color: '#777',
  },

  tableNumber: {
    marginTop: 8,
    fontSize: 64,
    fontWeight: '900',
    color: '#f68c45',
    textAlign: 'center',
  },

  tapText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#555',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});