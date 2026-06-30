// All values are read from Supabase tables managed by the web admin:
// - ingredients.current_stock
// - menu_item_ingredients.quantity_required
// - menu_items.is_available
// - menu_items.stock_label (optional override from web)
//
// IMPORTANT FIX:
// If a menu item has no linked ingredients yet, do NOT force it unavailable.
// Return null max_order_quantity, meaning "no computed ingredient limit".
// Mobile treats 0 as sold out, but null as no limit.

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase();
};

const isAvailableFalse = (value) => {
  return (
    value === false ||
    value === 0 ||
    value === '0' ||
    normalizeText(value) === 'false' ||
    normalizeText(value) === 'no' ||
    normalizeText(value) === 'unavailable' ||
    normalizeText(value) === 'sold out'
  );
};

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

    if (recipeError) {
      console.log(
        'RECIPE FETCH ERROR:',
        recipeError
      );

      return null;
    }

    // FIX:
    // No linked ingredients should NOT mean sold out.
    // It means no ingredient-based limit yet.
    if (
      !recipeRows ||
      recipeRows.length === 0
    ) {
      return null;
    }

    let maxServings =
      Infinity;

    for (const recipe of recipeRows) {
      const ingredientId =
        recipe.ingredient_id;

      const quantityRequired =
        Number(
          recipe.quantity_required
        );

      if (
        !ingredientId ||
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
        .select(
          'id, name, current_stock'
        )
        .eq('id', ingredientId)
        .single();

      if (
        ingredientError ||
        !ingredientRow
      ) {
        console.log(
          'INGREDIENT FETCH ERROR:',
          ingredientError
        );

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
      return null;
    }

    return maxServings;
  };

const resolveStockLabel = (
  menuItem,
  maxOrderQuantity
) => {
  const webLabel =
    menuItem?.stock_label
      ? String(
          menuItem.stock_label
        ).trim()
      : '';

  if (webLabel) {
    return webLabel;
  }

  if (
    maxOrderQuantity === null ||
    maxOrderQuantity === undefined
  ) {
    return null;
  }

  const safeMaxOrderQuantity =
    Number(maxOrderQuantity);

  if (
    !Number.isFinite(
      safeMaxOrderQuantity
    )
  ) {
    return null;
  }

  if (
    safeMaxOrderQuantity <= 0
  ) {
    return 'Sold out';
  }

  if (
    safeMaxOrderQuantity >= 1 &&
    safeMaxOrderQuantity <= 5
  ) {
    return safeMaxOrderQuantity === 1
      ? 'Only 1 order left'
      : `Only ${safeMaxOrderQuantity} orders left`;
  }

  return null;
};

const enrichMenuItemInventory = (
  menuItem,
  maxOrderQuantity
) => {
  const manuallyAvailable =
    !isAvailableFalse(
      menuItem?.is_available
    );

  const stockLabel =
    resolveStockLabel(
      menuItem,
      maxOrderQuantity
    );

  // FIX:
  // maxOrderQuantity null means no ingredient limit.
  // Do not force unavailable.
  if (
    maxOrderQuantity === null ||
    maxOrderQuantity === undefined
  ) {
    return {
      available_quantity: null,

      max_order_quantity: null,

      stock_label:
        stockLabel ||
        (manuallyAvailable
          ? 'Available'
          : 'Unavailable'),

      is_available:
        manuallyAvailable,
    };
  }

  const numericMaxOrderQuantity =
    Number(maxOrderQuantity);

  const safeMaxOrderQuantity =
    Number.isFinite(
      numericMaxOrderQuantity
    )
      ? Math.max(
          0,
          numericMaxOrderQuantity
        )
      : 0;

  return {
    available_quantity:
      safeMaxOrderQuantity,

    max_order_quantity:
      safeMaxOrderQuantity,

    stock_label:
      stockLabel ||
      (safeMaxOrderQuantity > 0
        ? null
        : 'Sold out'),

    is_available:
      manuallyAvailable &&
      safeMaxOrderQuantity > 0,
  };
};

module.exports = {
  computePossibleServings,
  computeMaxServingsFromRecipes,
  resolveStockLabel,
  enrichMenuItemInventory,
};