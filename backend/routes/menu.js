const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const { supabase, isConfigured } = require('../supabaseClient');

router.get('/', async (req, res) => {
  if (!isConfigured) {
    return res.json({ success: true, data: db.menuItems });
  }

  const { data, error } = await supabase.from('menu_items').select('*').order('id', { ascending: true });
  if (error) return res.status(500).json({ success: false, message: error.message });
  return res.json({ success: true, data: data || [] });
});

router.get('/category/:category', async (req, res) => {
  const category = req.params.category;

  if (!isConfigured) {
    const items = db.menuItems.filter(item => item.category.toLowerCase() === category.toLowerCase());
    return res.json({ success: true, data: items });
  }

  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('category', category);

  if (error) return res.status(500).json({ success: false, message: error.message });
  return res.json({ success: true, data: data || [] });
});

module.exports = router;
