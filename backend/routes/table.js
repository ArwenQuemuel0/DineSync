const express = require('express');

const router = express.Router();

const { supabase, isConfigured } = require('../supabaseClient');

const {
  buildTableStatusPayload,
  fetchTableStatusForUser,
} = require('../utils/tableStatus');

// =========================
// DATE / TIME HELPERS
// IMPORTANT:
// Backend stores UTC.
// Mobile displays using Asia/Manila.
// This prevents timestamp strings without timezone
// from being parsed incorrectly by React Native.
// =========================

const getUtcNowIso = () => {
  return new Date().toISOString();
};

const normalizeUtcIsoDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString();
  }

  const stringValue =
    String(value).trim();

  if (!stringValue) {
    return null;
  }

  const hasTimezone =
    /z$/i.test(stringValue) ||
    /[+-]\d{2}:\d{2}$/.test(stringValue);

  const safeValue =
    hasTimezone
      ? stringValue
      : `${stringValue}Z`;

  const date =
    new Date(safeValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return stringValue;
  }

  return date.toISOString();
};

const normalizeDateFields = (row) => {
  if (!row) {
    return row;
  }

  return {
    ...row,

    created_at:
      normalizeUtcIsoDate(
        row.created_at
      ),

    updated_at:
      normalizeUtcIsoDate(
        row.updated_at
      ),

    last_seen_at:
      normalizeUtcIsoDate(
        row.last_seen_at
      ),

    paid_at:
      normalizeUtcIsoDate(
        row.paid_at
      ),

    xendit_expiry_date:
      normalizeUtcIsoDate(
        row.xendit_expiry_date
      ),
  };
};

// =========================
// PAYMENT DISPLAY SAFETY
// If an order has Xendit fields, it is QR PH / Digital Payment.
// This prevents old/missing payment_method rows from showing Pay Later.
// =========================

const hasXenditInvoice = (order) => {
  return Boolean(
    order?.xendit_invoice_id ||
      order?.xendit_external_id ||
      order?.xendit_invoice_url
  );
};

const forceDigitalPaymentIfXendit = (order) => {
  if (!order) {
    return order;
  }

  const normalizedOrder =
    normalizeDateFields(order);

  if (hasXenditInvoice(normalizedOrder)) {
    return {
      ...normalizedOrder,
      payment_method: 'Digital Payment',
    };
  }

  return normalizedOrder;
};

// =========================
// GET LOGGED-IN TABLE USER
// Token format:
// Bearer table-token-1
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
    user:
      normalizeDateFields(user),
  };
};

// =========================
// GET RESTAURANT TABLE BY TABLE NUMBER
// =========================

const getRestaurantTableByNumber = async (
  tableNumber
) => {
  const {
    data: restaurantTable,
    error,
  } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq(
      'table_number',
      tableNumber
    )
    .single();

  if (error || !restaurantTable) {
    return {
      error,
      restaurantTable: null,
    };
  }

  return {
    error: null,
    restaurantTable:
      normalizeDateFields(
        restaurantTable
      ),
  };
};

// =========================
// FIND ACTIVE TABLE SESSION
// =========================

const getActiveTableSession = async (
  restaurantTableId
) => {
  const {
    data,
    error,
  } = await supabase
    .from('table_sessions')
    .select('*')
    .eq(
      'restaurant_table_id',
      restaurantTableId
    )
    .eq('status', 'active')
    .order('created_at', {
      ascending: false,
    })
    .limit(1);

  if (error) {
    return {
      error,
      session: null,
    };
  }

  return {
    error: null,
    session:
      data && data.length > 0
        ? normalizeDateFields(data[0])
        : null,
  };
};

// =========================
// CREATE ACTIVE TABLE SESSION
// =========================

const createTableSession = async (
  restaurantTable
) => {
  const now =
    getUtcNowIso();

  const sessionPayload = {
    restaurant_table_id:
      restaurantTable.id,

    session_code:
      `TABLE-${restaurantTable.table_number}-${Date.now()}`,

    status: 'active',
    created_at: now,
    updated_at: now,
  };

  const {
    data,
    error,
  } = await supabase
    .from('table_sessions')
    .insert(sessionPayload)
    .select('*')
    .single();

  if (error) {
    return {
      error,
      session: null,
    };
  }

  return {
    error: null,
    session:
      normalizeDateFields(data),
  };
};

// =========================
// ENSURE ACTIVE TABLE SESSION
// =========================

const ensureActiveTableSession = async (
  tableNumber
) => {
  const {
    error: tableError,
    restaurantTable,
  } =
    await getRestaurantTableByNumber(
      tableNumber
    );

  if (
    tableError ||
    !restaurantTable
  ) {
    return {
      error:
        tableError ||
        new Error(
          `Table No. ${tableNumber} was not found.`
        ),
      restaurantTable: null,
      session: null,
    };
  }

  const {
    error: sessionLookupError,
    session: existingSession,
  } =
    await getActiveTableSession(
      restaurantTable.id
    );

  if (sessionLookupError) {
    return {
      error: sessionLookupError,
      restaurantTable,
      session: null,
    };
  }

  if (existingSession) {
    return {
      error: null,
      restaurantTable,
      session: existingSession,
    };
  }

  const {
    error: createError,
    session: newSession,
  } =
    await createTableSession(
      restaurantTable
    );

  if (createError) {
    return {
      error: createError,
      restaurantTable,
      session: null,
    };
  }

  return {
    error: null,
    restaurantTable,
    session: newSession,
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
      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const now =
      getUtcNowIso();

    const {
      data: updatedUser,
      error: userUpdateError,
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

    if (userUpdateError) {
      throw userUpdateError;
    }

    const normalizedUpdatedUser =
      normalizeDateFields(
        updatedUser
      );

    const {
      error: statusError,
      payload: tableStatus,
    } =
      await fetchTableStatusForUser(
        supabase,
        normalizedUpdatedUser,
        getRestaurantTableByNumber,
        getActiveTableSession
      );

    if (statusError) {
      console.log(
        'TABLE ONLINE STATUS ERROR:',
        statusError
      );
    }

    console.log(
      `TABLET ${normalizedUpdatedUser.table_number} IS NOW ONLINE`
    );

    return res.json({
      success: true,
      message:
        'Tablet marked as online.',
      data:
        normalizedUpdatedUser,
      ...tableStatus,
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
      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const now =
      getUtcNowIso();

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
      throw error;
    }

    const normalizedData =
      normalizeDateFields(data);

    const {
      error: statusError,
      payload: tableStatus,
    } =
      await fetchTableStatusForUser(
        supabase,
        normalizedData,
        getRestaurantTableByNumber,
        getActiveTableSession
      );

    if (statusError) {
      console.log(
        'TABLE HEARTBEAT STATUS ERROR:',
        statusError
      );
    }

    return res.json({
      success: true,
      message:
        'Tablet heartbeat received.',
      data:
        normalizedData,
      ...tableStatus,
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
      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const now =
      getUtcNowIso();

    const {
      error: tableError,
      restaurantTable,
    } =
      await getRestaurantTableByNumber(
        user.table_number
      );

    if (
      tableError ||
      !restaurantTable
    ) {
      return res.status(404).json({
        success: false,
        message:
          `Table No. ${user.table_number} was not found.`,
      });
    }

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
      throw error;
    }

    return res.json({
      success: true,
      message:
        'Tablet marked as offline. Table session preserved.',
      data:
        normalizeDateFields(data),
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

// =========================
// TABLE STATUS
// GET /api/table/status
// =========================

router.get('/status', async (req, res) => {
  try {
    const {
      error: authError,
      user,
    } = await getLoggedInTableUser(
      req
    );

    if (authError) {
      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const {
      error: statusError,
      payload,
    } =
      await fetchTableStatusForUser(
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
    console.error(
      'TABLE STATUS ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch table status.',
    });
  }
});

// =========================
// TABLE ORDER HISTORY
// GET /api/table/order-history
// =========================

router.get('/order-history', async (req, res) => {
  try {
    console.log(
      'GET /api/table/order-history HIT'
    );

    const {
      error: authError,
      user,
    } = await getLoggedInTableUser(
      req
    );

    if (authError) {
      return res.status(401).json({
        success: false,
        message: authError,
      });
    }

    const {
      error: tableError,
      restaurantTable,
    } =
      await getRestaurantTableByNumber(
        user.table_number
      );

    if (
      tableError ||
      !restaurantTable
    ) {
      return res.status(404).json({
        success: false,
        message:
          `Table No. ${user.table_number} was not found.`,
      });
    }

    const {
      error: sessionLookupError,
      session: activeSession,
    } =
      await getActiveTableSession(
        restaurantTable.id
      );

    if (
      sessionLookupError ||
      !activeSession
    ) {
      return res.json({
        success: true,
        data: [],
        message:
          'No active table session found.',
      });
    }

    const {
      data: orders,
      error: ordersError,
    } = await supabase
      .from('orders')
      .select(
        'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, paid_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
      )
      .eq(
        'table_session_id',
        activeSession.id
      )
      .order('created_at', {
        ascending: true,
      });

    if (ordersError) {
      throw ordersError;
    }

    const normalizedOrders =
      (orders || []).map(
        forceDigitalPaymentIfXendit
      );

    const orderIds =
      normalizedOrders.map(
        (order) => order.id
      );

    if (orderIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        session:
          normalizeDateFields(
            activeSession
          ),
      });
    }

    const {
      data: orderItems,
      error: itemsError,
    } = await supabase
      .from('order_items')
      .select('*')
      .in(
        'order_id',
        orderIds
      );

    if (itemsError) {
      throw itemsError;
    }

    const menuItemIds = [
      ...new Set(
        (orderItems || [])
          .map(
            (item) =>
              item.menu_item_id
          )
          .filter(Boolean)
      ),
    ];

    let menuItems = [];

    if (menuItemIds.length > 0) {
      const {
        data: menuData,
        error: menuError,
      } = await supabase
        .from('menu_items')
        .select(
          'id, name, price, category, image'
        )
        .in(
          'id',
          menuItemIds
        );

      if (menuError) {
        throw menuError;
      }

      menuItems =
        menuData || [];
    }

    const enrichedOrders =
      normalizedOrders.map((order) => {
        const items =
          (orderItems || [])
            .filter(
              (item) =>
                Number(item.order_id) ===
                Number(order.id)
            )
            .map((item) => {
              const menuItem =
                menuItems.find(
                  (menu) =>
                    Number(menu.id) ===
                    Number(
                      item.menu_item_id
                    )
                );

              const price =
                Number(
                  item.price ||
                    menuItem?.price ||
                    0
                );

              const quantity =
                Number(
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
                subtotal:
                  price * quantity,
                menu_item:
                  menuItem || null,
              };
            });

        return {
          ...order,
          items,
        };
      });

    return res.json({
      success: true,
      data:
        enrichedOrders,
      session:
        normalizeDateFields(
          activeSession
        ),
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
        'Failed to fetch table order history.',
    });
  }
});

module.exports = router;