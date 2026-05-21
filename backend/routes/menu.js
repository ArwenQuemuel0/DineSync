const express = require('express');

const router = express.Router();

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

// =========================
// REQUIRE SUPABASE
// =========================

const requireSupabase = (res) => {
  if (!isConfigured || !supabase) {
    return res.status(500).json({
      success: false,
      message:
        'Supabase is not configured. Check backend .env SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  return null;
};

// =========================
// NORMALIZE FLAVOR TAGS
// =========================

const normalizeFlavorTags = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed
        .map((tag) => String(tag).trim())
        .filter(Boolean);
    }
  } catch (error) {
    // Continue to comma split
  }

  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

// =========================
// NORMALIZE MEAL TYPE
// =========================

const normalizeMealType = (value) => {
  if (!value) {
    return null;
  }

  return String(value).trim();
};

// =========================
// NORMALIZE MENU ITEM
// For mobile menu + AI recommendations
// =========================

const normalizeMenuItem = (item) => {
  return {
    ...item,

    image_url:
      item.image_url ||
      item.image ||
      null,

    flavor_tags:
      normalizeFlavorTags(
        item.flavor_tags
      ),

    meal_type:
      normalizeMealType(
        item.meal_type
      ),
  };
};

// =========================
// GET TOP BEST SELLER IDS
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
// COMPUTE AVAILABLE QUANTITY
// FROM DATABASE STOCK
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
      return normalizeMenuItem({
        ...menuItem,
        available_quantity: 0,
        is_available: false,
      });
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
        .select('id, name, current_stock')
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
      menuItem.is_available !== false &&
      menuItem.is_available !== 0 &&
      menuItem.is_available !== 'false' &&
      menuItem.is_available !== '0';

    return normalizeMenuItem({
      ...menuItem,
      available_quantity:
        maxServings,
      is_available:
        manuallyAvailable &&
        maxServings > 0,
    });
  };

// =========================
// GET ALL MENU ITEMS
// GET /api/menu
// =========================

router.get('/', async (req, res) => {
  try {
    const configError =
      requireSupabase(res);

    if (configError) return;

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

            return normalizeMenuItem({
              ...enrichedItem,
              is_best_seller:
                bestSellerIds.includes(
                  Number(item.id)
                ),
            });
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
// GET /api/menu/best-sellers
// =========================

router.get(
  '/best-sellers',
  async (req, res) => {
    try {
      const configError =
        requireSupabase(res);

      if (configError) return;

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

              return normalizeMenuItem({
                ...enrichedItem,
                is_best_seller: true,
              });
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
// GET /api/menu/category/:category
// =========================

router.get(
  '/category/:category',
  async (req, res) => {
    try {
      const configError =
        requireSupabase(res);

      if (configError) return;

      const category =
        req.params.category;

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

              return normalizeMenuItem({
                ...enrichedItem,
                is_best_seller:
                  bestSellerIds.includes(
                    Number(item.id)
                  ),
              });
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