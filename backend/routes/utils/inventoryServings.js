// All values are read from Supabase tables managed by the web admin:
// - ingredients.current_stock
// - menu_item_ingredients.quantity_required
// - menu_items.is_available
// - menu_items.stock_label (optional override from web)

const computePossibleServings = (
  currentStock,
  quantityRequired
) => {
  const stock =
    Number(currentStock);
  const required =
    Number(quantityRequired);

  if (
    !Number.isFinite(stock) ||
    !Number.isFinite(required) ||
    required <= 0 ||
    stock <= 0
  ) {
    return 0;
  }

  return Math.floor(
    stock / required
  );
};

const computeMaxServingsFromRecipes =
  async (
    supabase,
    menuItemId
  ) => {
    const {
      data: recipeRows,
      error: recipeError,
    } = await supabase
      .from('menu_item_ingredients')
      .select('*')
      .eq('menu_item_id', menuItemId);

    if (
      recipeError ||
      !recipeRows ||
      recipeRows.length === 0
    ) {
      return 0;
    }

    let maxServings = Infinity;

    for (const recipe of recipeRows) {
      const ingredientId =
        recipe.ingredient_id;

      const quantityRequired =
        Number(
          recipe.quantity_required
        );

      if (
        !Number.isFinite(
          quantityRequired
        ) ||
        quantityRequired <= 0
      ) {
        return 0;
      }

      const {
        data: ingredientRow,
        error: ingredientError,
      } = await supabase
        .from('ingredients')
        .select('id, name, current_stock')
        .eq('id', ingredientId)
        .single();

      if (
        ingredientError ||
        !ingredientRow
      ) {
        return 0;
      }

      const possibleServings =
        computePossibleServings(
          ingredientRow.current_stock,
          quantityRequired
        );

      if (possibleServings <= 0) {
        return 0;
      }

      if (
        possibleServings <
        maxServings
      ) {
        maxServings =
          possibleServings;
      }
    }

    if (
      !Number.isFinite(
        maxServings
      )
    ) {
      return 0;
    }

    return maxServings;
  };

const resolveStockLabel = (
  menuItem,
  maxOrderQuantity
) => {
  const webLabel = menuItem?.stock_label
    ? String(menuItem.stock_label).trim()
    : '';

  if (webLabel) {
    return webLabel;
  }

  if (
    maxOrderQuantity >= 1 &&
    maxOrderQuantity <= 5
  ) {
    return maxOrderQuantity === 1
      ? 'Only 1 order left'
      : `Only ${maxOrderQuantity} orders left`;
  }

  return null;
};

const enrichMenuItemInventory = (
  menuItem,
  maxOrderQuantity
) => {
  const manuallyAvailable =
    menuItem.is_available !== false &&
    menuItem.is_available !== 0 &&
    menuItem.is_available !== 'false' &&
    menuItem.is_available !== '0';

  const stockLabel =
    resolveStockLabel(
      menuItem,
      maxOrderQuantity
    );

  return {
    available_quantity:
      maxOrderQuantity,
    max_order_quantity:
      maxOrderQuantity,
    stock_label: stockLabel,
    is_available:
      manuallyAvailable &&
      maxOrderQuantity > 0,
  };
};

module.exports = {
  computePossibleServings,
  computeMaxServingsFromRecipes,
  resolveStockLabel,
  enrichMenuItemInventory,
};
