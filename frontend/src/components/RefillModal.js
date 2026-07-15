import React, {
    useMemo,
    useState,
  } from "react";
  
  import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    FlatList,
    TextInput,
    ActivityIndicator,
    Alert,
  } from "react-native";
  
  import {
    createRefillRequest,
    extractApiErrorMessage,
  } from "../api/dinesync";
  
  export default function RefillModal({
    visible,
    order,
    orderItem,
    onClose,
    onSuccess,
  }) {
    const [
      selectedIngredientIds,
      setSelectedIngredientIds,
    ] = useState([]);
  
    const [notes, setNotes] =
      useState("");
  
    const [submitting, setSubmitting] =
      useState(false);
  
    const ingredients = useMemo(() => {
      const list =
        orderItem?.ingredients ||
        orderItem?.menu_item?.ingredients ||
        [];
  
      return Array.isArray(list)
        ? list.filter(
            (ingredient) =>
              ingredient?.is_refillable === true &&
              Number(
                ingredient?.refill_quantity || 0
              ) > 0
          )
        : [];
    }, [orderItem]);
  
    const closeModal = () => {
      if (submitting) {
        return;
      }
  
      setSelectedIngredientIds([]);
      setNotes("");
      onClose?.();
    };
  
    const toggleIngredient = (
      ingredientId
    ) => {
      const numericId =
        Number(ingredientId);
  
      setSelectedIngredientIds(
        (current) =>
          current.includes(numericId)
            ? current.filter(
                (id) => id !== numericId
              )
            : [...current, numericId]
      );
    };
  
    const submit = async () => {
      if (submitting) {
        return;
      }
  
      if (
        selectedIngredientIds.length === 0
      ) {
        Alert.alert(
          "Select Ingredients",
          "Please select at least one refill ingredient."
        );
  
        return;
      }
  
      try {
        setSubmitting(true);
  
        const response =
          await createRefillRequest({
            orderId: order?.id,
            orderItemId: orderItem?.id,
            menuItemId:
              orderItem?.menu_item_id ||
              orderItem?.menu_item?.id,
            ingredientIds:
              selectedIngredientIds,
            notes,
          });
  
        if (!response?.success) {
          throw new Error(
            response?.message ||
            "Failed to send refill request."
          );
        }
  
        setSelectedIngredientIds([]);
        setNotes("");
        onSuccess?.(response);
      } catch (error) {
        Alert.alert(
          "Refill Request Failed",
          extractApiErrorMessage(
            error,
            "Unable to send the refill request."
          )
        );
      } finally {
        setSubmitting(false);
      }
    };
  
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>
                  Request Refill
                </Text>
  
                <Text style={styles.itemName}>
                  {orderItem?.name ||
                    orderItem?.menu_item?.name ||
                    "Unlimited Menu Item"}
                </Text>
              </View>
  
              <TouchableOpacity
                disabled={submitting}
                onPress={closeModal}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
  
            <Text style={styles.instruction}>
              Select one or more refill ingredients.
            </Text>
  
            {ingredients.length === 0 ? (
              <Text style={styles.emptyText}>
                No refillable ingredients are configured for this item.
              </Text>
            ) : (
              <FlatList
                data={ingredients}
                keyExtractor={(ingredient) =>
                  String(
                    ingredient.ingredient_id ||
                    ingredient.id
                  )
                }
                style={styles.list}
                renderItem={({ item }) => {
                  const ingredientId =
                    Number(
                      item.ingredient_id ||
                      item.id
                    );
  
                  const selected =
                    selectedIngredientIds.includes(
                      ingredientId
                    );
  
                  return (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[
                        styles.option,
                        selected &&
                          styles.optionSelected,
                      ]}
                      onPress={() =>
                        toggleIngredient(
                          ingredientId
                        )
                      }
                    >
                      <View
                        style={[
                          styles.checkbox,
                          selected &&
                            styles.checkboxSelected,
                        ]}
                      >
                        {selected ? (
                          <Text style={styles.checkmark}>
                            ✓
                          </Text>
                        ) : null}
                      </View>
  
                      <View style={styles.optionText}>
                        <Text style={styles.ingredientName}>
                          {item.name ||
                            "Ingredient"}
                        </Text>
  
                        <Text style={styles.quantityText}>
                          {Number(
                            item.refill_quantity || 0
                          )}{" "}
                          {item.unit || ""}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
  
            <Text style={styles.notesLabel}>
              Notes (optional)
            </Text>
  
            <TextInput
              value={notes}
              onChangeText={setNotes}
              editable={!submitting}
              multiline
              textAlignVertical="top"
              maxLength={300}
              placeholder="Add a note for the kitchen"
              placeholderTextColor="#999"
              style={styles.notesInput}
            />
  
            <View style={styles.actions}>
              <TouchableOpacity
                disabled={submitting}
                style={styles.cancelButton}
                onPress={closeModal}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </TouchableOpacity>
  
              <TouchableOpacity
                disabled={
                  submitting ||
                  selectedIngredientIds.length === 0
                }
                style={[
                  styles.submitButton,
                  (
                    submitting ||
                    selectedIngredientIds.length === 0
                  ) &&
                    styles.submitButtonDisabled,
                ]}
                onPress={submit}
              >
                {submitting ? (
                  <ActivityIndicator
                    size="small"
                    color="#fff"
                  />
                ) : (
                  <Text style={styles.submitText}>
                    Send Request
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
  
  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor:
        "rgba(0, 0, 0, 0.45)",
      justifyContent: "flex-end",
    },
  
    sheet: {
      maxHeight: "88%",
      backgroundColor: "#fff",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 24,
    },
  
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
  
    headerText: {
      flex: 1,
    },
  
    title: {
      color: "#333",
      fontSize: 21,
      fontWeight: "900",
    },
  
    itemName: {
      marginTop: 3,
      color: "#f68c45",
      fontSize: 15,
      fontWeight: "900",
    },
  
    closeButton: {
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
  
    closeText: {
      color: "#777",
      fontWeight: "900",
    },
  
    instruction: {
      marginTop: 14,
      marginBottom: 10,
      color: "#666",
      fontWeight: "700",
    },
  
    emptyText: {
      color: "#777",
      fontWeight: "700",
      paddingVertical: 14,
      textAlign: "center",
    },
  
    list: {
      maxHeight: 280,
    },
  
    option: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#fafafa",
      borderWidth: 1,
      borderColor: "#e8e8e8",
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
  
    optionSelected: {
      backgroundColor: "#fff4eb",
      borderColor: "#f68c45",
    },
  
    checkbox: {
      width: 23,
      height: 23,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: "#bbb",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 11,
    },
  
    checkboxSelected: {
      backgroundColor: "#f68c45",
      borderColor: "#f68c45",
    },
  
    checkmark: {
      color: "#fff",
      fontWeight: "900",
    },
  
    optionText: {
      flex: 1,
    },
  
    ingredientName: {
      color: "#333",
      fontWeight: "900",
    },
  
    quantityText: {
      marginTop: 2,
      color: "#777",
      fontWeight: "700",
    },
  
    notesLabel: {
      marginTop: 12,
      marginBottom: 7,
      color: "#333",
      fontWeight: "900",
    },
  
    notesInput: {
      minHeight: 82,
      maxHeight: 120,
      backgroundColor: "#fafafa",
      borderWidth: 1,
      borderColor: "#ddd",
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: "#333",
    },
  
    actions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
  
    cancelButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#f68c45",
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
  
    cancelText: {
      color: "#f68c45",
      fontWeight: "900",
    },
  
    submitButton: {
      flex: 1.4,
      backgroundColor: "#f68c45",
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
  
    submitButtonDisabled: {
      backgroundColor: "#c9c9c9",
    },
  
    submitText: {
      color: "#fff",
      fontWeight: "900",
    },
  });