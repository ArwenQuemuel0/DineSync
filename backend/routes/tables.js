const express = require('express');

const router = express.Router();

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

// =========================
// GET TABLE BY TABLE NUMBER
// Example: /api/tables/1
// =========================

router.get('/:tableNumber', async (req, res) => {
  try {
    const tableNumber = Number(
      req.params.tableNumber
    );

    if (!tableNumber) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table number',
      });
    }

    if (!isConfigured) {
      return res.json({
        success: true,
        data: {
          id: 1,
          table_number: tableNumber,
          capacity: 4,
          status: 'available',
          current_guest_count: 0,
        },
      });
    }

    const {
      data,
      error,
    } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq(
        'table_number',
        tableNumber
      )
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: 'Table not found',
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.log(
      'TABLE ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch table',
    });
  }
});

module.exports = router;