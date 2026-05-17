const express = require('express');

const router = express.Router();

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

// =========================
// GET ALL MENU ITEMS
// GET /api/menu
// =========================

router.get('/', async (req, res) => {
  try {
    console.log('GET /api/menu HIT');

    if (!isConfigured || !supabase) {
      console.log('SUPABASE NOT CONFIGURED');

      return res.status(500).json({
        success: false,
        message:
          'Supabase is not configured. Check backend .env file.',
      });
    }

    console.log(
      'FETCHING FROM SUPABASE TABLE: menu_items'
    );

    const {
      data: menuItems,
      error,
    } = await supabase
      .from('menu_items')
      .select('*')
      .order('id', {
        ascending: true,
      });

    if (error) {
      console.log(
        'SUPABASE MENU ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
        error,
      });
    }

    console.log(
      'MENU ITEMS COUNT:',
      menuItems?.length || 0
    );

    console.log(
      'MENU ITEM NAMES:',
      (menuItems || []).map(
        (item) => item.name
      )
    );

    return res.json({
      success: true,
      data: menuItems || [],
    });
  } catch (error) {
    console.log(
      'MENU ROUTE ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch menu.',
    });
  }
});

// =========================
// GET MENU ITEMS BY CATEGORY
// GET /api/menu/category/:category
// =========================

router.get(
  '/category/:category',
  async (req, res) => {
    try {
      const category =
        req.params.category;

      if (!isConfigured || !supabase) {
        return res.status(500).json({
          success: false,
          message:
            'Supabase is not configured. Check backend .env file.',
        });
      }

      const {
        data: menuItems,
        error,
      } = await supabase
        .from('menu_items')
        .select('*')
        .eq('category', category)
        .order('id', {
          ascending: true,
        });

      if (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
          error,
        });
      }

      return res.json({
        success: true,
        data: menuItems || [],
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to fetch category menu.',
      });
    }
  }
);

// =========================
// GET BEST SELLERS
// GET /api/menu/best-sellers
// =========================

router.get(
  '/best-sellers',
  async (req, res) => {
    try {
      if (!isConfigured || !supabase) {
        return res.status(500).json({
          success: false,
          message:
            'Supabase is not configured. Check backend .env file.',
        });
      }

      const {
        data: menuItems,
        error,
      } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_best_seller', true)
        .order('id', {
          ascending: true,
        })
        .limit(3);

      if (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
          error,
        });
      }

      return res.json({
        success: true,
        data: menuItems || [],
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to fetch best sellers.',
      });
    }
  }
);

module.exports = router;