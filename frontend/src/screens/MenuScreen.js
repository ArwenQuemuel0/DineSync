import React, {
  useEffect,
  useState,
} from 'react';

import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
  Modal,
} from 'react-native';

import {
  useFocusEffect,
  CommonActions,
} from '@react-navigation/native';

import { getMenu } from '../api/dinesync';

import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTableStatus } from '../context/TableStatusContext';

import {
  getItemId,
  isItemOrderable,
  isOutOfStock,
  canIncreaseQuantity,
  getAvailabilityDisplayText,
  shouldShowLowStockWarning,
} from '../utils/inventory';

export default function MenuScreen({
  navigation,
}) {
  const [menuItems, setMenuItems] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState('');

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState('All');

  const [
    logoutModalVisible,
    setLogoutModalVisible,
  ] = useState(false);

  const [
    logoutPassword,
    setLogoutPassword,
  ] = useState('');

  const {
    user,
    tableNumber,
    logout,
  } = useAuth();

  const {
    addToCart,
    cartItems,
    updateQuantity,
    incrementQuantity,
    removeFromCart,
    cartTotal,
    syncMenuInventory,
    refreshCartInventory,
    getEnrichedItem,
    validateCurrentCart,
  } = useCart();

  const {
    canOrder,
    ensureCanOrder,
    refreshTableStatus,
    assignmentMessage,
  } = useTableStatus();

  useEffect(() => {
    fetchMenu();

    const refreshTimer =
      setInterval(() => {
        fetchMenu();
      }, 15000);

    return () =>
      clearInterval(refreshTimer);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchMenu();
      refreshTableStatus();
    }, [refreshTableStatus])
  );

  const fetchMenu = async () => {
    try {
      const response =
        await getMenu();

      console.log(
        'MENU RESPONSE:',
        response
      );

      if (response.success) {
        setMenuItems(
          response.data
        );

        syncMenuInventory(
          response.data
        );
      } else {
        Alert.alert(
          'Error',
          response.message ||
            'Failed to fetch menu.'
        );
      }
    } catch (error) {
      console.error(
        'Failed to fetch menu:',
        error?.response?.data ||
          error.message
      );

      Alert.alert(
        'Error',
        'Failed to fetch menu.'
      );
    } finally {
      setLoading(false);
    }
  };

  const openLogoutModal = () => {
    setLogoutPassword('');
    setLogoutModalVisible(true);
  };

  const closeLogoutModal = () => {
    setLogoutPassword('');
    setLogoutModalVisible(false);
  };

  const handleConfirmLogout = async () => {
    const result =
      await logout(logoutPassword);

    if (!result.success) {
      Alert.alert(
        'Logout Failed',
        result.message ||
          'Unable to logout.'
      );

      return;
    }

    closeLogoutModal();

    navigation.replace('Login');
  };

  const formatMoney = (value) => {
    const n = Number(value);

    return Number.isFinite(n)
      ? n.toFixed(2)
      : '0.00';
  };

  const getItemImage = (item) => {
    const image =
      item?.image
        ? String(item.image).trim()
        : '';

    return image;
  };

  const isBestSeller = (item) => {
    return (
      item.is_best_seller === true ||
      item.is_best_seller === 1 ||
      item.is_best_seller === 'true' ||
      item.is_best_seller === '1'
    );
  };

  const handleAddToCart = (item) => {
    if (!isItemOrderable(item)) {
      Alert.alert(
        'Out of Stock',
        'This item is currently out of stock.'
      );

      return;
    }

    addToCart(item);
  };

  const handleIncreaseQuantity = (
    item
  ) => {
    incrementQuantity(
      getItemId(item)
    );
  };

  const handleDecreaseQuantity = (
    item
  ) => {
    const itemId =
      getItemId(item);

    updateQuantity(
      itemId,
      item.quantity - 1
    );
  };

  const handleRemoveFromCart = (
    item
  ) => {
    const itemId =
      getItemId(item);

    removeFromCart(itemId);
  };

  const handleGoToWelcome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      })
    );
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert(
        'Empty Order',
        'Please add at least one item before proceeding.'
      );

      return;
    }

    const tableCheck =
      await ensureCanOrder();

    if (!tableCheck.allowed) {
      Alert.alert(
        'Table Not Assigned',
        tableCheck.message ||
          assignmentMessage
      );

      return;
    }

    const inventoryCheck =
      await refreshCartInventory();

    if (!inventoryCheck.valid) {
      Alert.alert(
        'Limited Stock',
        inventoryCheck.message
      );

      return;
    }

    if (!tableNumber && !user?.table_number) {
      Alert.alert(
        'Table Error',
        'No table number found. Please login again using the assigned table account.'
      );

      return;
    }

    navigation.navigate(
      'Payment',
      {
        cartItems,
        total: cartTotal,
        tableNumber:
          tableNumber ||
          user?.table_number,
      }
    );
  };

  const categories = [
    'All',
    ...new Set(
      menuItems
        .map((m) => m.category)
        .filter(Boolean)
    ),
  ];

  const filteredItems =
    menuItems
      .filter((item) => {
        const byCategory =
          selectedCategory === 'All' ||
          item.category === selectedCategory;

        const bySearch =
          !search ||
          (item.name || '')
            .toLowerCase()
            .includes(
              search.toLowerCase()
            );

        return byCategory && bySearch;
      })
      .sort((a, b) => {
        const aAvailable =
          isItemOrderable(a);

        const bAvailable =
          isItemOrderable(b);

        return (
          Number(bAvailable) -
          Number(aAvailable)
        );
      });

  const totalQuantity =
    cartItems.reduce(
      (total, item) =>
        total +
        Number(item.quantity || 0),
      0
    );

  const renderMenuItem = ({
    item,
  }) => {
    const imageUri =
      getItemImage(item);

    const isAvailable =
      isItemOrderable(item);

    const isLowStock =
      shouldShowLowStockWarning(item);

    const availabilityText =
      getAvailabilityDisplayText(item);

    const bestSeller =
      isBestSeller(item);

    return (
      <TouchableOpacity
        style={[
          styles.menuItem,
          !isAvailable &&
            styles.unavailableItem,
        ]}
        disabled={!isAvailable}
        onPress={() =>
          navigation.navigate(
            'ItemDetail',
            { item }
          )
        }
      >
        {bestSeller ? (
          <View
            style={
              styles.bestSellerBadge
            }
          >
            <Text
              style={
                styles.bestSellerBadgeText
              }
            >
              🔥 Popular
            </Text>
          </View>
        ) : null}

        <View
          style={
            styles.itemImageCircle
          }
        >
          <Image
            source={
              imageUri
                ? { uri: imageUri }
                : require('../../assets/placeholder-food.png')
            }
            style={
              styles.itemImage
            }
            resizeMode="cover"
          />
        </View>

        <View style={styles.itemInfo}>
          <Text
            style={styles.itemName}
            numberOfLines={2}
          >
            {item.name}
          </Text>

          <Text style={styles.itemPrice}>
            ₱{formatMoney(item.price)}
          </Text>

          <Text
            style={
              !isAvailable
                ? styles.notAvailableText
                : isLowStock
                  ? styles.lowStockText
                  : styles.availableText
            }
          >
            {availabilityText}
          </Text>

          <Text style={styles.tapText}>
            Tap to view
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCartItem = ({
    item,
  }) => {
    const enrichedItem =
      getEnrichedItem(item);

    const atMaxQuantity =
      !canIncreaseQuantity(
        enrichedItem,
        item.quantity,
        1
      );

    return (
      <View style={styles.cartItem}>
        <View style={styles.cartItemTop}>
          <View
            style={styles.cartItemInfo}
          >
            <Text
              style={styles.cartItemName}
              numberOfLines={2}
            >
              {item.name}
            </Text>

            <Text
              style={styles.cartItemPrice}
            >
              ₱{formatMoney(item.price)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() =>
              handleRemoveFromCart(
                item
              )
            }
          >
            <Text style={styles.removeText}>
              ×
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.qtyRow}>
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() =>
              handleDecreaseQuantity(
                item
              )
            }
          >
            <Text
              style={styles.qtyButtonText}
            >
              -
            </Text>
          </TouchableOpacity>

          <Text style={styles.qtyText}>
            {item.quantity}
          </Text>

          <TouchableOpacity
            style={[
              styles.qtyButton,
              (atMaxQuantity ||
                isOutOfStock(enrichedItem)) &&
                styles.qtyButtonDisabled,
            ]}
            disabled={
              atMaxQuantity ||
              isOutOfStock(enrichedItem)
            }
            onPress={() => {
              if (
                !atMaxQuantity &&
                !isOutOfStock(
                  enrichedItem
                )
              ) {
                handleIncreaseQuantity(
                  item
                );
              }
            }}
          >
            <Text
              style={styles.qtyButtonText}
            >
              +
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        style={{ flex: 1 }}
      />
    );
  }

  return (
    <View style={styles.frame}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={handleGoToWelcome}
          >
            <Text style={styles.topBarText}>
              {'<'} Go Back
            </Text>
          </TouchableOpacity>

          <View style={styles.topIcons}>
            <Text style={styles.tableText}>
              Table {tableNumber || user?.table_number || '-'}
            </Text>

            <TouchableOpacity
              style={styles.historyButton}
              onPress={() =>
                navigation.navigate(
                  'OrderHistory'
                )
              }
            >
              <Text style={styles.historyButtonText}>
                Order History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statusButton}
              onPress={() =>
                navigation.navigate(
                  'OrderStatus'
                )
              }
            >
              <Text
                style={
                  styles.statusButtonText
                }
              >
                View Order Status
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={openLogoutModal}
            >
              <Text style={styles.logoutButtonText}>
                Staff Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={
            false
          }
          style={styles.categoryBar}
          contentContainerStyle={{
            paddingHorizontal: 10,
            alignItems: 'center',
          }}
          renderItem={({
            item: category,
          }) => (
            <TouchableOpacity
              style={[
                styles.categoryBtn,
                selectedCategory ===
                  category &&
                  styles.categoryBtnActive,
              ]}
              onPress={() =>
                setSelectedCategory(
                  category
                )
              }
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory ===
                    category &&
                    styles.categoryTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          )}
        />

        {!canOrder ? (
          <View
            style={
              styles.assignmentBanner
            }
          >
            <Text
              style={
                styles.assignmentBannerText
              }
            >
              {assignmentMessage}
            </Text>
          </View>
        ) : null}

        <View style={styles.contentArea}>
          <View style={styles.menuSection}>
            <FlatList
              data={filteredItems}
              renderItem={
                renderMenuItem
              }
              numColumns={3}
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
              keyExtractor={(
                item,
                index
              ) =>
                String(
                  getItemId(item) ||
                    index
                )
              }
              columnWrapperStyle={{
                justifyContent:
                  'space-evenly',
                marginBottom: 14,
              }}
              contentContainerStyle={{
                paddingVertical: 10,
                paddingBottom: 30,
              }}
            />
          </View>

          <View style={styles.cartSidebar}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartIcon}>
                🛒
              </Text>

              <Text style={styles.cartTitle}>
                Your Order
              </Text>
            </View>

            {cartItems.length === 0 ? (
              <Text
                style={styles.emptyCartText}
              >
                No items added yet.
              </Text>
            ) : (
              <FlatList
                data={cartItems}
                keyExtractor={(item) =>
                  String(
                    getItemId(item)
                  )
                }
                renderItem={
                  renderCartItem
                }
                showsVerticalScrollIndicator={
                  false
                }
                contentContainerStyle={{
                  paddingBottom: 20,
                }}
              />
            )}

            <View style={styles.cartFooter}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Total:
                </Text>

                <Text style={styles.totalValue}>
                  ₱{formatMoney(cartTotal)}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.checkoutButton,
                  (cartItems.length === 0 ||
                    !canOrder) &&
                    styles.checkoutButtonDisabled,
                ]}
                disabled={
                  cartItems.length === 0 ||
                  !canOrder
                }
                onPress={handleCheckout}
              >
                <Text
                  style={
                    styles.checkoutButtonText
                  }
                >
                  Checkout ({totalQuantity})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.searchBar}>
          <TextInput
            placeholder="Search menu"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />

          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => {}}
          >
            <Text
              style={
                styles.searchButtonText
              }
            >
              Search
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        transparent
        visible={logoutModalVisible}
        animationType="fade"
        onRequestClose={closeLogoutModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.logoutModal}>
            <Text style={styles.modalTitle}>
              Staff Logout
            </Text>

            <Text style={styles.modalText}>
              Enter staff password to logout this tablet.
            </Text>

            <TextInput
              style={styles.passwordInput}
              value={logoutPassword}
              onChangeText={setLogoutPassword}
              placeholder="Enter password"
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeLogoutModal}
              >
                <Text style={styles.cancelButtonText}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmLogout}
              >
                <Text style={styles.confirmButtonText}>
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles =
  StyleSheet.create({
    frame: {
      flex: 1,
      backgroundColor: '#171717',
    },

    container: {
      flex: 1,
      backgroundColor: '#efefef',
    },

    topBar: {
      height: 70,
      backgroundColor: '#b8b3b3',
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
    },

    topBarText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 28,
    },

    topIcons: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    tableText: {
      color: '#fff',
      fontSize: 20,
      fontWeight: '900',
      marginRight: 14,
    },

    historyButton: {
      backgroundColor: '#fff',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 12,
      marginRight: 14,
    },

    historyButtonText: {
      color: '#f68c45',
      fontSize: 15,
      fontWeight: '900',
    },

    statusButton: {
      backgroundColor: '#f68c45',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 12,
      marginRight: 14,
    },

    statusButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
    },

    logoutButton: {
      backgroundColor: '#333',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 12,
      marginRight: 14,
    },

    logoutButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
    },

    iconSpacing: {
      color: '#f2f2f2',
      fontSize: 28,
      marginRight: 20,
    },

    categoryBar: {
      maxHeight: 70,
      backgroundColor: '#f7f7f7',
      borderBottomWidth: 1,
      borderColor: '#e3e3e3',
    },

    categoryBtn: {
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderRadius: 24,
      backgroundColor: '#ececec',
      marginRight: 10,
    },

    categoryBtnActive: {
      backgroundColor: '#f68c45',
    },

    categoryText: {
      fontWeight: '700',
      fontSize: 18,
      color: '#333',
    },

    categoryTextActive: {
      color: '#fff',
    },

    assignmentBanner: {
      backgroundColor: '#fff4e8',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 12,
    },

    assignmentBannerText: {
      color: '#8a4b12',
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 22,
    },

    contentArea: {
      flex: 1,
      flexDirection: 'row',
    },

    menuSection: {
      flex: 1,
      paddingTop: 14,
      paddingHorizontal: 8,
    },

    menuItem: {
      width: 230,
      height: 250,
      backgroundColor: '#fff',
      borderWidth: 1.5,
      borderColor: '#f0b287',
      borderRadius: 18,
      marginHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      position: 'relative',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },

    unavailableItem: {
      opacity: 0.45,
    },

    bestSellerBadge: {
      position: 'absolute',
      top: 10,
      left: 10,
      backgroundColor: '#fff4eb',
      borderWidth: 1,
      borderColor: '#f68c45',
      borderRadius: 999,
      paddingVertical: 5,
      paddingHorizontal: 10,
      zIndex: 10,
    },

    bestSellerBadgeText: {
      color: '#f68c45',
      fontSize: 12,
      fontWeight: '900',
    },

    itemImageCircle: {
      width: 105,
      height: 105,
      borderRadius: 55,
      backgroundColor: '#ececec',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      marginTop: 8,
    },

    itemImage: {
      width: '100%',
      height: '100%',
    },

    itemEmoji: {
      fontSize: 42,
    },

    itemInfo: {
      alignItems: 'center',
      marginTop: 8,
    },

    itemName: {
      fontWeight: '800',
      fontSize: 21,
      textAlign: 'center',
      marginTop: 8,
    },

    itemPrice: {
      color: '#777',
      marginTop: 6,
      fontSize: 18,
      fontWeight: '700',
    },

    availableText: {
      color: '#4CAF50',
      fontSize: 15,
      fontWeight: '700',
      marginTop: 8,
    },

    notAvailableText: {
      color: 'red',
      fontSize: 15,
      fontWeight: '700',
      marginTop: 8,
    },

    lowStockText: {
      color: '#e67e22',
      fontSize: 15,
      fontWeight: '700',
      marginTop: 8,
    },

    tapText: {
      marginTop: 8,
      color: '#999',
      fontSize: 13,
      fontWeight: '700',
    },

    cartSidebar: {
      width: 310,
      backgroundColor: '#fff',
      borderLeftWidth: 1,
      borderLeftColor: '#ddd',
      paddingHorizontal: 14,
      paddingTop: 16,
    },

    cartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },

    cartIcon: {
      fontSize: 24,
      marginRight: 8,
    },

    cartTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: '#222',
    },

    emptyCartText: {
      fontSize: 16,
      color: '#777',
      marginTop: 10,
    },

    cartItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#eeeeee',
    },

    cartItemTop: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'flex-start',
    },

    cartItemInfo: {
      flex: 1,
      paddingRight: 8,
    },

    cartItemName: {
      fontSize: 15,
      fontWeight: '800',
      color: '#222',
    },

    cartItemPrice: {
      fontSize: 14,
      fontWeight: '700',
      color: '#f68c45',
      marginTop: 4,
    },

    removeText: {
      fontSize: 24,
      fontWeight: '800',
      color: '#999',
    },

    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
    },

    qtyButton: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: '#f68c45',
      justifyContent: 'center',
      alignItems: 'center',
    },

    qtyButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    qtyButtonText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 18,
    },

    qtyText: {
      fontSize: 16,
      fontWeight: '800',
      marginHorizontal: 12,
    },

    cartFooter: {
      borderTopWidth: 1,
      borderTopColor: '#dddddd',
      paddingTop: 14,
      paddingBottom: 14,
    },

    totalRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },

    totalLabel: {
      fontSize: 18,
      fontWeight: '800',
      color: '#333',
    },

    totalValue: {
      fontSize: 22,
      fontWeight: '900',
      color: '#f68c45',
    },

    checkoutButton: {
      backgroundColor: '#f68c45',
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },

    checkoutButtonDisabled: {
      backgroundColor: '#c9c9c9',
    },

    checkoutButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
    },

    searchBar: {
      borderTopWidth: 1,
      borderColor: '#ddd',
      padding: 14,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#fafafa',
    },

    searchInput: {
      width: '60%',
      backgroundColor: '#fff',
      borderRadius: 28,
      borderWidth: 1,
      borderColor: '#ddd',
      paddingHorizontal: 18,
      paddingVertical: 12,
      marginRight: 12,
      fontSize: 18,
    },

    searchButton: {
      backgroundColor: '#f68c45',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },

    searchButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 18,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0, 0, 0, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },

    logoutModal: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: 24,
    },

    modalTitle: {
      fontSize: 28,
      fontWeight: '900',
      color: '#333',
      textAlign: 'center',
      marginBottom: 8,
    },

    modalText: {
      fontSize: 16,
      color: '#666',
      textAlign: 'center',
      marginBottom: 18,
      lineHeight: 22,
    },

    passwordInput: {
      backgroundColor: '#f7f7f7',
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 17,
      marginBottom: 20,
    },

    modalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },

    cancelButton: {
      flex: 1,
      backgroundColor: '#ddd',
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: 'center',
      marginRight: 8,
    },

    cancelButtonText: {
      color: '#333',
      fontSize: 16,
      fontWeight: '800',
    },

    confirmButton: {
      flex: 1,
      backgroundColor: '#f68c45',
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: 'center',
      marginLeft: 8,
    },

    confirmButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
    },
  });