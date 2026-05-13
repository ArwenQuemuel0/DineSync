const express = require('express');

const router = express.Router();

const db = require('../mockDb');

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

// =========================
// GET ALL MENU ITEMS
// =========================

router.get('/', async (req, res) => {
  try {
    // =========================
    // MOCK DB FALLBACK
    // =========================

    if (!isConfigured) {
      return res.json({
        success: true,
        data: db.menuItems,
      });
    }

    // =========================
    // GET MENU ITEMS FROM SUPABASE
    // =========================

    const {
      data,
      error,
    } = await supabase
      .from('menu_items')
      .select('*')
      .order('id', {
        ascending: true,
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    // =========================
    // TEMPORARY STOCK / AVAILABILITY
    // IGNORE INGREDIENTS FOR NOW
    // =========================

    const menuItems = (data || []).map((item) => ({
      ...item,

      available_quantity:
        Number(item.available_quantity) ||
        Number(item.stock) ||
        10,

      is_available:
        item.is_available === false
          ? false
          : true,
    }));

    return res.json({
      success: true,
      data: menuItems,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =========================
// GET MENU ITEMS BY CATEGORY
// =========================

router.get('/category/:category', async (req, res) => {
  try {
    const category = req.params.category;

    // =========================
    // MOCK DB FALLBACK
    // =========================

    if (!isConfigured) {
      const items = db.menuItems.filter(
        (item) =>
          item.category.toLowerCase() ===
          category.toLowerCase()
      );

      return res.json({
        success: true,
        data: items,
      });
    }

    // =========================
    // GET CATEGORY FROM SUPABASE
    // =========================

    const {
      data,
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
      });
    }

    // =========================
    // TEMPORARY STOCK / AVAILABILITY
    // IGNORE INGREDIENTS FOR NOW
    // =========================

    const menuItems = (data || []).map((item) => ({
      ...item,

      available_quantity:
        Number(item.available_quantity) ||
        Number(item.stock) ||
        10,

      is_available:
        item.is_available === false
          ? false
          : true,
    }));

    return res.json({
      success: true,
      data: menuItems,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;