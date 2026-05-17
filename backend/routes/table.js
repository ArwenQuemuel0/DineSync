const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// =========================
// SUPABASE CONNECTION
// =========================

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY;

const supabase =
  createClient(
    supabaseUrl,
    supabaseKey
  );

// =========================
// GET LOGGED-IN TABLE USER
// Token format:
// Bearer table-token-1
//
// In this project,
// table-token-1 means Table Number 1,
// NOT user id 1.
// =========================

const getLoggedInTableUser = async (req) => {
  const authHeader =
    req.headers.authorization || '';

  console.log(
    'TABLE AUTH HEADER:',
    authHeader
  );

  const token =
    authHeader.replace(
      'Bearer ',
      ''
    );

  if (!token) {
    return {
      error: 'No token provided.',
      user: null,
    };
  }

  if (
    !token.startsWith(
      'table-token-'
    )
  ) {
    return {
      error:
        `Invalid token format: ${token}`,
      user: null,
    };
  }

  const tableNumber =
    Number(
      token.replace(
        'table-token-',
        ''
      )
    );

  console.log(
    'TABLE TOKEN TABLE NUMBER:',
    tableNumber
  );

  if (!tableNumber) {
    return {
      error: 'Invalid table token.',
      user: null,
    };
  }

  const {
    data: user,
    error,
  } = await supabase
    .from('users')
    .select(
      'id, name, email, role, table_number, is_online, last_seen_at'
    )
    .eq('role', 'table_customer')
    .eq('table_number', tableNumber)
    .single();

  if (error || !user) {
    console.log(
      'TABLE USER LOOKUP ERROR:',
      error
    );

    return {
      error:
        `No table customer account found for Table ${tableNumber}.`,
      user: null,
    };
  }

  console.log(
    'TABLE USER FOUND:',
    user
  );

  if (
    user.role !== 'table_customer'
  ) {
    return {
      error:
        'Only table customer accounts can update table status.',
      user: null,
    };
  }

  if (!user.table_number) {
    return {
      error:
        'This account has no assigned table number.',
      user: null,
    };
  }

  return {
    error: null,
    user,
  };
};

// =========================
// TABLE ONLINE
// POST /api/table/online
// =========================

router.post('/online', async (req, res) => {
  try {
    console.log(
      'POST /api/table/online HIT'
    );

    const {
      error: authError,
      user,
    } = await getLoggedInTableUser(
      req
    );

    if (authError) {
      console.log(
        'TABLE ONLINE AUTH ERROR:',
        authError
      );

      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const now =
      new Date().toISOString();

    const {
      data,
      error,
    } = await supabase
      .from('users')
      .update({
        is_online: true,
        last_seen_at: now,
      })
      .eq('id', user.id)
      .select(
        'id, name, email, role, table_number, is_online, last_seen_at'
      )
      .single();

    if (error) {
      console.log(
        'TABLE ONLINE SUPABASE ERROR:',
        error
      );

      throw error;
    }

    console.log(
      `TABLE ${data.table_number} IS NOW ONLINE:`,
      data
    );

    return res.json({
      success: true,
      message:
        'Table marked as online.',
      data,
    });
  } catch (error) {
    console.error(
      'TABLE ONLINE ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to mark table online.',
      error:
        error.message ||
        String(error),
    });
  }
});

// =========================
// TABLE HEARTBEAT
// POST /api/table/heartbeat
// =========================

router.post('/heartbeat', async (req, res) => {
  try {
    console.log(
      'POST /api/table/heartbeat HIT'
    );

    const {
      error: authError,
      user,
    } = await getLoggedInTableUser(
      req
    );

    if (authError) {
      console.log(
        'TABLE HEARTBEAT AUTH ERROR:',
        authError
      );

      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const now =
      new Date().toISOString();

    const {
      data,
      error,
    } = await supabase
      .from('users')
      .update({
        is_online: true,
        last_seen_at: now,
      })
      .eq('id', user.id)
      .select(
        'id, name, email, role, table_number, is_online, last_seen_at'
      )
      .single();

    if (error) {
      console.log(
        'TABLE HEARTBEAT SUPABASE ERROR:',
        error
      );

      throw error;
    }

    console.log(
      `TABLE ${data.table_number} HEARTBEAT UPDATED:`,
      data
    );

    return res.json({
      success: true,
      message:
        'Table heartbeat received.',
      data,
    });
  } catch (error) {
    console.error(
      'TABLE HEARTBEAT ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to send table heartbeat.',
      error:
        error.message ||
        String(error),
    });
  }
});

// =========================
// TABLE OFFLINE
// POST /api/table/offline
// =========================

router.post('/offline', async (req, res) => {
  try {
    console.log(
      'POST /api/table/offline HIT'
    );

    const {
      error: authError,
      user,
    } = await getLoggedInTableUser(
      req
    );

    if (authError) {
      console.log(
        'TABLE OFFLINE AUTH ERROR:',
        authError
      );

      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const now =
      new Date().toISOString();

    const {
      data,
      error,
    } = await supabase
      .from('users')
      .update({
        is_online: false,
        last_seen_at: now,
      })
      .eq('id', user.id)
      .select(
        'id, name, email, role, table_number, is_online, last_seen_at'
      )
      .single();

    if (error) {
      console.log(
        'TABLE OFFLINE SUPABASE ERROR:',
        error
      );

      throw error;
    }

    console.log(
      `TABLE ${data.table_number} IS NOW OFFLINE:`,
      data
    );

    return res.json({
      success: true,
      message:
        'Table marked as offline.',
      data,
    });
  } catch (error) {
    console.error(
      'TABLE OFFLINE ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to mark table offline.',
      error:
        error.message ||
        String(error),
    });
  }
});

module.exports = router;