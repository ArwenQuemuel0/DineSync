
const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const { supabase } = require('../supabaseClient');
const {
  fetchTableStatusForUser,
} = require('../utils/tableStatus');

// ========================================
// HELPERS
// ========================================

const now = () => new Date().toISOString();

const normalizeDate = (value) => {
  if (!value) return null;

  const str = String(value).trim();
  if (!str) return null;

  const withTimezone =
    /z$/i.test(str) || /[+-]\d{2}:\d{2}$/.test(str)
      ? str
      : `${str}Z`;

  const date = new Date(withTimezone);

  return Number.isNaN(date.getTime())
    ? str
    : date.toISOString();
};

const normalizeDateFields = (row) => {
  if (!row) return row;

  return {
    ...row,
    created_at: normalizeDate(row.created_at),
    updated_at: normalizeDate(row.updated_at),
    last_seen_at: normalizeDate(row.last_seen_at),
    paid_at: normalizeDate(row.paid_at),
    xendit_expiry_date: normalizeDate(
      row.xendit_expiry_date
    ),
  };
};

const forceDigitalPaymentIfXendit = (order) => {
  if (!order) return order;

  const normalized = normalizeDateFields(order);

  const hasXendit = Boolean(
    normalized.xendit_invoice_id ||
    normalized.xendit_external_id ||
    normalized.xendit_invoice_url
  );

  return {
    ...normalized,
    payment_method: hasXendit
      ? 'Digital Payment'
      : normalized.payment_method,
  };
};

const normalizeStatus = (value) =>
  String(value || '').trim().toLowerCase();

// ========================================
// TABLE AUTHENTICATION
// Existing token compatibility preserved.
// TODO: Replace predictable table tokens
// with verified, revocable login tokens.
// ========================================

const getLoggedInTableUser = async (req) => {
  const authHeader = req.headers.authorization || '';

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : '';

  const match = /^table-token-(\d+)$/.exec(token);

  if (!match) {
    return {
      error: 'Invalid table authentication.',
      user: null,
    };
  }

  const tableNumber = Number(match[1]);

  const { data, error } = await supabase
    .from('users')
    .select(
      'id, name, email, role, table_number, is_online, last_seen_at'
    )
    .eq('role', 'table_customer')
    .eq('table_number', tableNumber)
    .maybeSingle();

  if (error || !data) {
    return {
      error:
        error?.message ||
        'Table customer account not found.',
      user: null,
    };
  }

  return {
    error: null,
    user: normalizeDateFields(data),
  };
};

// ========================================
// TABLE LOOKUP
// ========================================

const getRestaurantTableByNumber = async (
  tableNumber
) => {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('table_number', tableNumber)
    .maybeSingle();

  return {
    error,
    restaurantTable: data
      ? normalizeDateFields(data)
      : null,
  };
};

// ========================================
// ACTIVE SESSION LOOKUP
// ========================================

const getActiveTableSession = async (
  restaurantTableId
) => {
  const { data, error } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('restaurant_table_id', restaurantTableId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);

  return {
    error,
    session: data?.length
      ? normalizeDateFields(data[0])
      : null,
  };
};

// ========================================
// CREATE SESSION
// ========================================

const createTableSession = async (
  restaurantTable
) => {
  const timestamp = now();

  const payload = {
    restaurant_table_id: restaurantTable.id,
    session_code:
      `TABLE-${restaurantTable.table_number}-${Date.now()}`,
    status: 'active',
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { data, error } = await supabase
    .from('table_sessions')
    .insert(payload)
    .select('*')
    .single();

  return {
    error,
    session: data
      ? normalizeDateFields(data)
      : null,
  };
};

// ========================================
// ENSURE ACTIVE SESSION
// ========================================

const ensureActiveTableSession = async (
  tableNumber
) => {
  const {
    restaurantTable,
    error: tableError,
  } = await getRestaurantTableByNumber(tableNumber);

  if (tableError || !restaurantTable) {
    return {
      error:
        tableError ||
        new Error('Restaurant table not found.'),
      restaurantTable: null,
      session: null,
    };
  }

  const {
    session,
    error: sessionError,
  } = await getActiveTableSession(
    restaurantTable.id
  );

  if (sessionError) {
    return {
      error: sessionError,
      restaurantTable,
      session: null,
    };
  }

  if (session) {
    return {
      error: null,
      restaurantTable,
      session,
    };
  }

  const created = await createTableSession(
    restaurantTable
  );

  return {
    error: created.error,
    restaurantTable,
    session: created.session,
  };
};

// ========================================
// STAFF PASSWORD
// ========================================

const verifyStaffPassword = (password) => {
  const expected =
    process.env.STAFF_LOGOUT_PASSWORD;

  if (!expected) {
    return {
      valid: false,
      message:
        'STAFF_LOGOUT_PASSWORD is not configured.',
      status: 503,
    };
  }

  const expectedHash = crypto
    .createHash('sha256')
    .update(expected)
    .digest();

  const providedHash = crypto
    .createHash('sha256')
    .update(String(password || ''))
    .digest();

  const valid = crypto.timingSafeEqual(
    expectedHash,
    providedHash
  );

  return {
    valid,
    status: valid ? 200 : 403,
    message: valid
      ? ''
      : 'Incorrect staff password.',
  };
};

// ========================================
// TABLE ONLINE - FIXED
// ========================================

router.post('/online', async (req, res) => {
  try {
    const {
      error: authError,
      user,
    } = await getLoggedInTableUser(req);

    if (authError) {
      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    // FIX: Update tablet presence fields.
    // Do not close customer sessions here.
    const { data, error } = await supabase
      .from('users')
      .update({
        is_online: true,
        last_seen_at: now(),
      })
      .eq('id', user.id)
      .eq('role', 'table_customer')
      .select(
        'id, name, email, role, table_number, is_online, last_seen_at'
      )
      .single();

    if (error) throw error;

    const normalized = normalizeDateFields(data);

    const {
      payload,
      error: statusError,
    } = await fetchTableStatusForUser(
      supabase,
      normalized,
      getRestaurantTableByNumber,
      getActiveTableSession
    );

    if (statusError) {
      console.error(
        'TABLE ONLINE STATUS ERROR:',
        statusError
      );
    }

    console.log(
      'TABLE ONLINE SUCCESS:',
      normalized.table_number,
      normalized.last_seen_at
    );

    return res.json({
      success: true,
      message: 'Tablet marked as online.',
      data: normalized,
      ...(payload || {}),
    });
  } catch (error) {
    console.error('TABLE ONLINE ERROR:', error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to mark tablet online.',
    });
  }
});

// ========================================
// TABLE HEARTBEAT
// ========================================

router.post('/heartbeat', async (req, res) => {
  try {
    const {
      error: authError,
      user,
    } = await getLoggedInTableUser(req);

    if (authError) {
      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        is_online: true,
        last_seen_at: now(),
      })
      .eq('id', user.id)
      .eq('role', 'table_customer')
      .select(
        'id, name, email, role, table_number, is_online, last_seen_at'
      )
      .single();

    if (error) throw error;

    const normalized = normalizeDateFields(data);

    const {
      payload,
      error: statusError,
    } = await fetchTableStatusForUser(
      supabase,
      normalized,
      getRestaurantTableByNumber,
      getActiveTableSession
    );

    if (statusError) {
      console.error(
        'TABLE HEARTBEAT STATUS ERROR:',
        statusError
      );
    }

    return res.json({
      success: true,
      message: 'Tablet heartbeat received.',
      data: normalized,
      ...(payload || {}),
    });
  } catch (error) {
    console.error(
      'TABLE HEARTBEAT ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to send heartbeat.',
    });
  }
});

// ========================================
// TABLE OFFLINE
// Does not close customer session.
// ========================================

router.post('/offline', async (req, res) => {
  try {
    const {
      error: authError,
      user,
    } = await getLoggedInTableUser(req);

    if (authError) {
      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const {
      restaurantTable,
      error: tableError,
    } = await getRestaurantTableByNumber(
      user.table_number
    );

    if (tableError || !restaurantTable) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant table not found.',
      });
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        is_online: false,
        last_seen_at: now(),
      })
      .eq('id', user.id)
      .eq('role', 'table_customer')
      .select(
        'id, name, email, role, table_number, is_online, last_seen_at'
      )
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      message:
        'Tablet marked offline. Session preserved.',
      data: normalizeDateFields(data),
    });
  } catch (error) {
    console.error('TABLE OFFLINE ERROR:', error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to mark tablet offline.',
    });
  }
});

// ========================================
// TABLE STATUS
// ========================================

router.get('/status', async (req, res) => {
  try {
    const {
      error: authError,
      user,
    } = await getLoggedInTableUser(req);

    if (authError) {
      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const {
      payload,
      error: statusError,
    } = await fetchTableStatusForUser(
      supabase,
      user,
      getRestaurantTableByNumber,
      getActiveTableSession
    );

    if (statusError || !payload) {
      return res.status(500).json({
        success: false,
        message:
          statusError?.message ||
          'Failed to fetch table status.',
      });
    }

    return res.json({
      success: true,
      ...payload,
    });
  } catch (error) {
    console.error('TABLE STATUS ERROR:', error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch table status.',
    });
  }
});

// ========================================
// REFILL HISTORY
// ========================================

const getOrderHistoryRefills = async (
  orderIds = []
) => {
  if (!orderIds.length) return [];

  const { data: refills, error } = await supabase
    .from('refills')
    .select(
      'id, order_id, order_item_id, menu_item_id, requested_by, table_number, status, notes, requested_at, preparing_at, ready_at, served_at'
    )
    .in('order_id', orderIds)
    .order('requested_at', { ascending: true });

  if (error) throw error;

  const refillIds = (refills || []).map(
    (refill) => refill.id
  );

  if (!refillIds.length) return [];

  const {
    data: refillItems,
    error: itemsError,
  } = await supabase
    .from('refill_items')
    .select(
      'id, refill_id, ingredient_id, quantity, unit, created_at, updated_at'
    )
    .in('refill_id', refillIds);

  if (itemsError) throw itemsError;

  const ingredientIds = [
    ...new Set(
      (refillItems || [])
        .map((item) => item.ingredient_id)
        .filter(Boolean)
    ),
  ];

  let ingredients = [];

  if (ingredientIds.length) {
    const {
      data,
      error: ingredientError,
    } = await supabase
      .from('ingredients')
      .select('id, name, unit')
      .in('id', ingredientIds);

    if (ingredientError) {
      throw ingredientError;
    }

    ingredients = data || [];
  }

  return (refills || []).map((refill) => ({
    ...refill,
    status: normalizeStatus(refill.status)
      .replace(/[-\s]+/g, '_'),
    requested_at: normalizeDate(
      refill.requested_at
    ),
    preparing_at: normalizeDate(
      refill.preparing_at
    ),
    ready_at: normalizeDate(
      refill.ready_at
    ),
    served_at: normalizeDate(
      refill.served_at
    ),
    items: (refillItems || [])
      .filter(
        (item) =>
          Number(item.refill_id) ===
          Number(refill.id)
      )
      .map((item) => {
        const ingredient = ingredients.find(
          (row) =>
            Number(row.id) ===
            Number(item.ingredient_id)
        );

        return {
          ...item,
          created_at: normalizeDate(
            item.created_at
          ),
          updated_at: normalizeDate(
            item.updated_at
          ),
          ingredient_name:
            ingredient?.name || 'Ingredient',
          ingredient: ingredient || null,
        };
      }),
  }));
};

// ========================================
// TABLE ORDER HISTORY
// Batch numbers belong to current session.
// ========================================

router.get('/order-history', async (req, res) => {
  try {
    const {
      error: authError,
      user,
    } = await getLoggedInTableUser(req);

    if (authError) {
      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const {
      restaurantTable,
      error: tableError,
    } = await getRestaurantTableByNumber(
      user.table_number
    );

    if (tableError || !restaurantTable) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant table not found.',
      });
    }

    const {
      session,
      error: sessionError,
    } = await getActiveTableSession(
      restaurantTable.id
    );

    if (sessionError) throw sessionError;

    if (!session) {
      return res.json({
        success: true,
        data: [],
        session: null,
      });
    }

    const {
      data: sessionOrders,
      error: batchError,
    } = await supabase
      .from('orders')
      .select('id, created_at')
      .eq('table_session_id', session.id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (batchError) throw batchError;

    const batchNumbers = new Map(
      (sessionOrders || []).map(
        (order, index) => [
          String(order.id),
          index + 1,
        ]
      )
    );

    const {
      data: orders,
      error: ordersError,
    } = await supabase
      .from('orders')
      .select(
        'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, paid_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
      )
      .eq('table_session_id', session.id)
      .in('status', [
        'served',
        'completed',
        'Served',
        'Completed',
      ])
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    const normalizedOrders = (orders || [])
      .map(forceDigitalPaymentIfXendit);

    const orderIds = normalizedOrders.map(
      (order) => order.id
    );

    if (!orderIds.length) {
      return res.json({
        success: true,
        data: [],
        session,
      });
    }

    const {
      data: orderItems,
      error: itemsError,
    } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    if (itemsError) throw itemsError;

    const menuItemIds = [
      ...new Set(
        (orderItems || [])
          .map((item) => item.menu_item_id)
          .filter(Boolean)
      ),
    ];

    let menuItems = [];

    if (menuItemIds.length) {
      const {
        data,
        error: menuError,
      } = await supabase
        .from('menu_items')
        .select(
          'id, name, price, category, image, is_unlimited'
        )
        .in('id', menuItemIds);

      if (menuError) throw menuError;

      menuItems = data || [];
    }

    const orderRefills =
      await getOrderHistoryRefills(orderIds);

    const enrichedOrders = normalizedOrders.map(
      (order) => {
        const items = (orderItems || [])
          .filter(
            (item) =>
              Number(item.order_id) ===
              Number(order.id)
          )
          .map((item) => {
            const menuItem = menuItems.find(
              (menu) =>
                Number(menu.id) ===
                Number(item.menu_item_id)
            );

            const price = Number(
              item.price ||
              menuItem?.price ||
              0
            );

            const quantity = Number(
              item.quantity || 0
            );

            return {
              ...item,
              name:
                item.name ||
                menuItem?.name ||
                'Menu Item',
              price,
              quantity,
              subtotal: price * quantity,
              is_unlimited:
                menuItem?.is_unlimited === true,
              menu_item: menuItem || null,
            };
          });

        const refills = (orderRefills || [])
          .filter(
            (refill) =>
              Number(refill.order_id) ===
              Number(order.id)
          );

        return {
          ...order,
          batch_number:
            batchNumbers.get(String(order.id)) ??
            null,
          items,
          refills,
        };
      }
    );

    return res.json({
      success: true,
      data: enrichedOrders,
      session,
    });
  } catch (error) {
    console.error(
      'TABLE ORDER HISTORY ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch order history.',
    });
  }
});

// ========================================
// END CUSTOMER SESSION
// Called by staff logout.
// ========================================

router.post('/end-session', async (req, res) => {
  try {
    const {
      error: authError,
      user,
    } = await getLoggedInTableUser(req);

    if (authError) {
      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const passwordCheck = verifyStaffPassword(
      req.body?.staff_password
    );

    if (!passwordCheck.valid) {
      return res.status(
        passwordCheck.status
      ).json({
        success: false,
        message: passwordCheck.message,
      });
    }

    const {
      restaurantTable,
      error: tableError,
    } = await getRestaurantTableByNumber(
      user.table_number
    );

    if (tableError || !restaurantTable) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant table not found.',
      });
    }

    const {
      session,
      error: sessionError,
    } = await getActiveTableSession(
      restaurantTable.id
    );

    if (sessionError) throw sessionError;

    if (!session) {
      return res.json({
        success: true,
        message: 'No active session to end.',
      });
    }

    const {
      data: orders,
      error: ordersError,
    } = await supabase
      .from('orders')
      .select(
        'id, status, payment_status, payment_method'
      )
      .eq('table_session_id', session.id);

    if (ordersError) throw ordersError;

    const unfinishedOrder = (orders || [])
      .find((order) => {
        const status = normalizeStatus(
          order.status
        );

        const paymentStatus = normalizeStatus(
          order.payment_status
        );

        if (
          status === 'cancelled' ||
          status === 'canceled'
        ) {
          return false;
        }

        const finished = [
          'served',
          'completed',
        ].includes(status);

        const paid = paymentStatus === 'paid';

        return !finished || !paid;
      });

    if (unfinishedOrder) {
      return res.status(409).json({
        success: false,
        message:
          'Complete and settle all orders before staff logout.',
      });
    }

    const {
      data: endedSession,
      error: endError,
    } = await supabase
      .from('table_sessions')
      .update({
        status: 'completed',
        updated_at: now(),
      })
      .eq('id', session.id)
      .eq('status', 'active')
      .select('id, status')
      .maybeSingle();

    if (endError) throw endError;

    if (!endedSession) {
      return res.status(409).json({
        success: false,
        message:
          'Session was already changed.',
      });
    }

    return res.json({
      success: true,
      message:
        'Customer session ended successfully.',
      data: endedSession,
    });
  } catch (error) {
    console.error('END SESSION ERROR:', error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to end customer session.',
    });
  }
});

// ========================================
// START NEW CUSTOMER SESSION
// ========================================

router.post('/start-session', async (req, res) => {
  try {
    const {
      error: authError,
      user,
    } = await getLoggedInTableUser(req);

    if (authError) {
      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const passwordCheck = verifyStaffPassword(
      req.body?.staff_password
    );

    if (!passwordCheck.valid) {
      return res.status(
        passwordCheck.status
      ).json({
        success: false,
        message: passwordCheck.message,
      });
    }

    const {
      restaurantTable,
      error: tableError,
    } = await getRestaurantTableByNumber(
      user.table_number
    );

    if (tableError || !restaurantTable) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant table not found.',
      });
    }

    const tableStatus = normalizeStatus(
      restaurantTable.status
    );

    if (tableStatus !== 'occupied') {
      return res.status(403).json({
        success: false,
        message:
          'Table must be assigned to customers before starting a session.',
      });
    }

    const {
      session: existingSession,
      error: sessionError,
    } = await getActiveTableSession(
      restaurantTable.id
    );

    if (sessionError) throw sessionError;

    if (existingSession) {
      return res.json({
        success: true,
        message:
          'Current customer session already exists.',
        data: existingSession,
        created: false,
      });
    }

    const {
      session: newSession,
      error: createError,
    } = await createTableSession(
      restaurantTable
    );

    if (createError) throw createError;

    return res.status(201).json({
      success: true,
      message:
        'New customer session started. Batch numbering resets to 1.',
      data: newSession,
      created: true,
    });
  } catch (error) {
    console.error('START SESSION ERROR:', error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to start customer session.',
    });
  }
});

module.exports = router;
