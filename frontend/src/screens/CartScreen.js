import React from 'react';

import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';

import { useCart } from '../context/CartContext';
import { placeOrder } from '../api/dinesync';

export default function CartScreen({
  navigation,
}) {
  const {
    cartItems,
    updateQuantity,
    cartTotal,
    clearCart,
  } = useCart();

  const formatMoney = (value) => {
    const n = Number(value);

    return Number.isFinite(n)
      ? n.toFixed(2)
      : '0.00';
  };

  const handleCheckout = async () => {
    try {
      const response =
        await placeOrder(cartItems);
  
      if (response.success) {
        clearCart();
  
        navigation.navigate(
          'Payment',
          {
            orderId:
              response.data.id,
            totalAmount:
              cartTotal,
          }
        );
      }
    } catch (error) {
      console.error(
        'Failed to place order:',
        error.response?.data ||
          error.message
      );
  
      Alert.alert(
        'Error',
        'Failed to place order. Please try again.'
      );
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemVisual}>
        <Text
          style={styles.itemVisualText}
        >
          🍜
        </Text>
      </View>

      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>
          {item.name}
        </Text>

        <Text style={styles.itemDesc}>
          Korean dish prepared fresh and
          served hot.
        </Text>

        <Text style={styles.itemPrice}>
          ₱{formatMoney(item.price)}
        </Text>
      </View>

      <View
        style={styles.quantityContainer}
      >
        <TouchableOpacity
          onPress={() =>
            updateQuantity(
              item.id,
              item.quantity - 1
            )
          }
          style={styles.qtyBtn}
        >
          <Text style={styles.qtyText}>
            -
          </Text>
        </TouchableOpacity>

        <Text style={styles.quantity}>
          {item.quantity}
        </Text>

        <TouchableOpacity
          onPress={() =>
            updateQuantity(
              item.id,
              item.quantity + 1
            )
          }
          style={styles.qtyBtn}
        >
          <Text style={styles.qtyText}>
            +
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.frame}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() =>
              navigation.goBack()
            }
          >
            <Text style={styles.backText}>
              {'<'} Go Back
            </Text>
          </TouchableOpacity>

          <Image
            source={require('../../assets/chefoppa_logo.png')}
            style={styles.logo}
            resizeMode={'contain'}
          />
        </View>

        <Text style={styles.header}>
          My Cart
        </Text>

        <TouchableOpacity
          onPress={clearCart}
        >
          <Text style={styles.clearText}>
            Clear Order
          </Text>
        </TouchableOpacity>

        <FlatList
          data={cartItems}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            String(item?.id || index)
          }
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={{
            paddingBottom: 20,
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Your cart is empty
            </Text>
          }
        />

        <View style={styles.footer}>
          <Text style={styles.totalText}>
            Total:{' '}
            ₱{formatMoney(cartTotal)}
          </Text>

          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={handleCheckout}
            disabled={
              cartItems.length === 0
            }
          >
            <Text
              style={styles.checkoutBtnText}
            >
              Order Now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: '#171717',
  },

  // MATCH ITEM DETAIL SCREEN
  container: {
    flex: 1,
    backgroundColor: '#efefef',
    padding: 32,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
  },

  backText: {
    fontSize: 28,
    color: '#3b3b3b',
    fontWeight: '700',
  },

  logo: {
    width: 80,
    height: 80,
  },

  header: {
    marginTop: 24,
    fontSize: 56,
    fontWeight: '800',
    color: '#3d3d3d',
  },

  clearText: {
    alignSelf: 'flex-end',
    color: '#999',
    marginBottom: 18,
    fontSize: 20,
    fontWeight: '600',
  },

  cartItem: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#f0b287',
    backgroundColor: '#f7f7f7',
    padding: 24,
    alignItems: 'center',
    marginBottom: 18,
    borderRadius: 20,
  },

  itemVisual: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },

  itemVisualText: {
    fontSize: 62,
  },

  itemInfo: {
    flex: 1,
    marginLeft: 24,
  },

  itemName: {
    fontSize: 38,
    fontWeight: '800',
    color: '#f68c45',
  },

  itemDesc: {
    color: '#888',
    fontSize: 20,
    marginTop: 6,
  },

  itemPrice: {
    color: '#2f2f2f',
    marginTop: 12,
    fontSize: 36,
    fontWeight: '700',
  },

  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  qtyBtn: {
    backgroundColor: '#e5e5e5',
    width: 62,
    height: 62,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 31,
  },

  qtyText: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#333',
  },

  quantity: {
    marginHorizontal: 22,
    fontSize: 34,
    fontWeight: '700',
    color: '#333',
  },

  // MATCH ITEM DETAIL ACTION BAR
  footer: {
    marginTop: 20,
    alignSelf: 'center',
    width: '82%',
    maxWidth: 920,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: '#fafafa',
    paddingVertical: 24,
    paddingHorizontal: 32,
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    borderRadius: 18,
  },

  totalText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#333',
  },

  checkoutBtn: {
    backgroundColor: '#f68c45',
    paddingVertical: 18,
    paddingHorizontal: 36,
    borderRadius: 20,
  },

  checkoutBtnText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },

  emptyText: {
    marginTop: 120,
    alignSelf: 'center',
    color: '#999',
    fontSize: 30,
  },
});