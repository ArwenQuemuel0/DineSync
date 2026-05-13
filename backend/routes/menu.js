const express = require('express');

const router = express.Router();

const db = require('../mockDb');

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

// =========================
// GET TOP BEST SELLER IDS
// BASED ON ORDER ITEMS
// =========================

const getBestSellerIds = async () => {
  const {
    data: orderItems,
    error,
  } = await supabase
    .from('order_items')
    .select('menu_item_id, quantity');

  if (error || !orderItems) {
    console.log(
      'BEST SELLER ERROR:',
      error
    );

    return [];
  }

  const salesCount = {};

  orderItems.forEach((item) => {
    const menuItemId =
      item.menu_item_id;

    const quantity =
      Number(item.quantity) || 0;

    if (!menuItemId) return;

    if (!salesCount[menuItemId]) {
      salesCount[menuItemId] = 0;
    }

    salesCount[menuItemId] += quantity;
  });

  const bestSellerIds =
    Object.entries(salesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([menuItemId]) =>
        Number(menuItemId)
      );

  return bestSellerIds;
};

// =========================
// COMPUTE AVAILABLE QUANTITY FROM DATABASE
// =========================

const computeAvailableQuantity =
  async (menuItem) => {
    const {
      data: recipeRows,
      error: recipeError,
    } = await supabase
      .from('menu_item_ingredients')
      .select('*')
      .eq(
        'menu_item_id',
        menuItem.id
      );

    if (
      recipeError ||
      !recipeRows ||
      recipeRows.length === 0
    ) {
      return {
        ...menuItem,
        available_quantity: 0,
        is_available: false,
      };
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
        maxServings = 0;
        break;
      }

      const {
        data: ingredientRow,
        error: ingredientError,
      } = await supabase
        .from('ingredients')
        .select('id, current_stock')
        .eq('id', ingredientId)
        .single();

      if (
        ingredientError ||
        !ingredientRow
      ) {
        maxServings = 0;
        break;
      }

      const currentStock =
        Number(
          ingredientRow.current_stock
        );

      if (
        !Number.isFinite(
          currentStock
        ) ||
        currentStock <= 0
      ) {
        maxServings = 0;
        break;
      }

      const possibleServings =
        Math.floor(
          currentStock /
            quantityRequired
        );

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
      maxServings = 0;
    }

    const manuallyAvailable =
      menuItem.is_available !==
      false;

    return {
      ...menuItem,
      available_quantity:
        maxServings,
      is_available:
        manuallyAvailable &&
        maxServings > 0,
    };
  };

// =========================
// GET ALL MENU ITEMS
// =========================

router.get('/', async (req, res) => {
  try {
    if (!isConfigured) {
      return res.json({
        success: true,
        data: db.menuItems,
      });
    }

    const {
      data: menuItems,
      error: menuError,
    } = await supabase
      .from('menu_items')
      .select('*')
      .order('id', {
        ascending: true,
      });

    if (menuError) {
      return res.status(500).json({
        success: false,
        message:
          menuError.message,
      });
    }

    const bestSellerIds =
      await getBestSellerIds();

    const enrichedMenuItems =
      await Promise.all(
        (menuItems || []).map(
          async (item) => {
            const enrichedItem =
              await computeAvailableQuantity(
                item
              );

            return {
              ...enrichedItem,
              is_best_seller:
                bestSellerIds.includes(
                  Number(item.id)
                ),
            };
          }
        )
      );

    return res.json({
      success: true,
      data: enrichedMenuItems,
    });
  } catch (error) {
    console.log(
      'MENU ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch menu',
    });
  }
});

// =========================
// GET TOP 3 BEST SELLERS
// =========================

router.get(
  '/best-sellers',
  async (req, res) => {
    try {
      if (!isConfigured) {
        return res.json({
          success: true,
          data: db.menuItems.slice(
            0,
            3
          ),
        });
      }

      const bestSellerIds =
        await getBestSellerIds();

      if (
        !bestSellerIds ||
        bestSellerIds.length === 0
      ) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const {
        data: menuItems,
        error,
      } = await supabase
        .from('menu_items')
        .select('*')
        .in(
          'id',
          bestSellerIds
        );

      if (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }

      const sortedMenuItems =
        bestSellerIds
          .map((id) =>
            (menuItems || []).find(
              (item) =>
                Number(item.id) ===
                Number(id)
            )
          )
          .filter(Boolean);

      const enrichedMenuItems =
        await Promise.all(
          sortedMenuItems.map(
            async (item) => {
              const enrichedItem =
                await computeAvailableQuantity(
                  item
                );

              return {
                ...enrichedItem,
                is_best_seller: true,
              };
            }
          )
        );

      return res.json({
        success: true,
        data: enrichedMenuItems,
      });
    } catch (error) {
      console.log(
        'BEST SELLERS ROUTE ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to fetch best sellers',
      });
    }
  }
);

// =========================
// GET MENU ITEMS BY CATEGORY
// =========================

router.get(
  '/category/:category',
  async (req, res) => {
    try {
      const category =
        req.params.category;

      if (!isConfigured) {
        const items =
          db.menuItems.filter(
            (item) =>
              item.category.toLowerCase() ===
              category.toLowerCase()
          );

        return res.json({
          success: true,
          data: items,
        });
      }

      const {
        data: menuItems,
        error,
      } = await supabase
        .from('menu_items')
        .select('*')
        .eq(
          'category',
          category
        )
        .order('id', {
          ascending: true,
        });

      if (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }

      const bestSellerIds =
        await getBestSellerIds();

      const enrichedMenuItems =
        await Promise.all(
          (menuItems || []).map(
            async (item) => {
              const enrichedItem =
                await computeAvailableQuantity(
                  item
                );

              return {
                ...enrichedItem,
                is_best_seller:
                  bestSellerIds.includes(
                    Number(item.id)
                  ),
              };
            }
          )
        );

      return res.json({
        success: true,
        data: enrichedMenuItems,
      });
    } catch (error) {
      console.log(
        'CATEGORY MENU ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to fetch category menu',
      });
    }
  }
);

module.exports = router;