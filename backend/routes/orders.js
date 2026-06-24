const express = require('express');

const router = express.Router();

const db = require('../mockDb');

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

const {
  computeMaxServingsFromRecipes,
} = require('../utils/inventoryServings');

const {
  TABLE_ASSIGNMENT_MESSAGE,
  normalizeTableStatus,
} = require('../utils/tableStatus');

const { createInvoice } = require('../utils/xendit');

// =========================
// DEFAULT IPAD TABLE
// =========================

const DEFAULT_TABLE_NUMBER = 1;

// =========================
// PAYMENT METHOD HELPERS
// =========================

const normalizePaymentMethod = (value) => {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');

  if (
    normalized === 'qr ph' ||
    normalized === 'qrph' ||
    normalized === 'xendit' ||
    normalized === 'online payment' ||
    normalized === 'electronic payment' ||
    normalized === 'digital payment'
  ) {
    return 'Digital Payment';
  }

  if (
    normalized === 'pay later' ||
    normalized === 'later'
  ) {
    return 'Pay Later';
  }

  if (
    normalized === 'pay at counter' ||
    normalized === 'pay counter' ||
    normalized === 'counter' ||
    normalized === 'cashier'
  ) {
    return 'Pay at Counter';
  }

  if (normalized === 'cash') {
    return 'Cash';
  }

  return 'Pay Later';
};

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

  if (hasXenditInvoice(order)) {
    return {
      ...order,
      payment_method: 'Digital Payment',
    };
  }

  return order;
};

const shouldCreateXenditInvoice = (paymentMethod) => {
  return paymentMethod === 'Digital Payment';
};

const getInitialOrderStatus = (paymentMethod) => {
  if (paymentMethod === 'Pay Later') {
    return 'pending';
  }

  if (
    paymentMethod === 'Pay at Counter' ||
    paymentMethod === 'Digital Payment'
  ) {
    return 'awaiting_payment';
  }

  return 'pending';
};

const buildMockExternalId = (orderId) => {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(now.getMonth() + 1)
      .padStart(2, '0');

  const day =
    String(now.getDate())
      .padStart(2, '0');

  const hour =
    String(now.getHours())
      .padStart(2, '0');

  const minute =
    String(now.getMinutes())
      .padStart(2, '0');

  return `ORDER-${orderId}-${year}${month}${day}${hour}${minute}`;
};

// =========================
// GET TABLE NUMBER FROM TOKEN
// Token format: Bearer table-token-1
// =========================

const getTableNumberFromToken = (req) => {
  const authHeader =
    req.headers.authorization || '';

  const token =
    authHeader.replace(
      'Bearer ',
      ''
    );

  if (
    token &&
    token.startsWith('table-token-')
  ) {
    const tableNumber =
      Number(
        token.replace(
          'table-token-',
          ''
        )
      );

    if (tableNumber) {
      return tableNumber;
    }
  }

  return null;
};

// =========================
// BEST SELLERS
// IMPORTANT: This must be before router.get('/:id')
// =========================

router.get(
  '/best-sellers/list',
  async (req, res) => {
    try {
      if (!isConfigured) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const {
        data,
        error,
      } = await supabase
        .from('order_items')
        .select(`
          menu_item_id,
          quantity,
          menu_items (
            id,
            name,
            price,
            category,
            image
          )
        `);

      if (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }

      const salesMap = {};

      for (const row of data || []) {
        const item = row.menu_items;

        if (!item) continue;

        const itemId = item.id;

        if (!salesMap[itemId]) {
          salesMap[itemId] = {
            ...item,
            total_sales: 0,
          };
        }

        salesMap[itemId].total_sales +=
          Number(row.quantity || 0);
      }

      const bestSellers =
        Object.values(salesMap)
          .sort(
            (a, b) =>
              b.total_sales -
              a.total_sales
          )
          .slice(0, 3);

      return res.json({
        success: true,
        data: bestSellers,
      });
    } catch (error) {
      console.log(
        'BEST SELLERS ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// =========================
// GET ACTIVE ORDERS BY TABLE
// GET /api/orders/table/:tableNumber/active
// IMPORTANT: This must be before router.get('/:id')
//
// KDS VISIBILITY RULE:
// Only pending, preparing, ready.
// Never awaiting_payment.
// =========================

router.get(
  '/table/:tableNumber/active',
  async (req, res) => {
    try {
      const tableNumber =
        Number(req.params.tableNumber);

      if (!tableNumber) {
        return res.status(400).json({
          success: false,
          message:
            'Table number is required.',
        });
      }

      if (!isConfigured) {
        const activeOrders =
          db.orders
            .filter((order) => {
              const status =
                String(order.status || '')
                  .toLowerCase();

              return (
                Number(order.table_number) ===
                tableNumber &&
                [
                  'pending',
                  'preparing',
                  'ready',
                ].includes(status)
              );
            })
            .map(forceDigitalPaymentIfXendit);

        return res.json({
          success: true,
          data: activeOrders,
        });
      }

      const {
        data: restaurantTable,
        error: tableError,
      } = await supabase
        .from('restaurant_tables')
        .select('id')
        .eq(
          'table_number',
          tableNumber
        )
        .single();

      if (
        tableError ||
        !restaurantTable
      ) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const {
        data: activeSessions,
        error: sessionError,
      } = await supabase
        .from('table_sessions')
        .select('id')
        .eq(
          'restaurant_table_id',
          restaurantTable.id
        )
        .eq('status', 'active')
        .order('created_at', {
          ascending: false,
        })
        .limit(1);

      if (
        sessionError ||
        !activeSessions ||
        activeSessions.length === 0
      ) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const activeSessionId =
        activeSessions[0].id;

      const {
        data: orders,
        error: ordersError,
      } = await supabase
        .from('orders')
        .select(
          'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date, paid_at'
        )
        .eq(
          'table_session_id',
          activeSessionId
        )
        .in('status', [
          'pending',
          'preparing',
          'ready',
          'Pending',
          'Preparing',
          'Ready',
        ])
        .order('created_at', {
          ascending: false,
        });

      if (ordersError) {
        throw ordersError;
      }

      const orderIds =
        (orders || []).map(
          (order) => order.id
        );

      if (orderIds.length === 0) {
        return res.json({
          success: true,
          data: [],
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
        (orders || []).map(
          (order) => {
            const fixedOrder =
              forceDigitalPaymentIfXendit(order);

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
              ...fixedOrder,
              items,
            };
          }
        );

      return res.json({
        success: true,
        data: enrichedOrders,
      });
    } catch (error) {
      console.log(
        'GET ACTIVE TABLE ORDERS ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to fetch active table orders.',
      });
    }
  }
);

// =========================
// CREATE ORDER
// POST /api/orders
// =========================

router.post('/', async (req, res) => {
  try {
    const {
      items,
      table_number,
      tableNumber,
    } = req.body;

    const tokenTableNumber =
      getTableNumberFromToken(req);

    const finalTableNumber =
      Number(
        table_number ||
        tableNumber ||
        tokenTableNumber ||
        DEFAULT_TABLE_NUMBER
      );

    const paymentMethod =
      normalizePaymentMethod(
        req.body.payment_method ||
        req.body.paymentMethod
      );

    const needInvoice =
      shouldCreateXenditInvoice(
        paymentMethod
      );

    const newOrderStatus =
      getInitialOrderStatus(
        paymentMethod
      );

    console.log(
      'REQ BODY:',
      JSON.stringify(req.body, null, 2)
    );

    console.log(
      'TABLE NUMBER:',
      finalTableNumber
    );

    console.log(
      'PAYMENT METHOD:',
      paymentMethod
    );

    console.log(
      'INITIAL ORDER STATUS:',
      newOrderStatus
    );

    console.log(
      'NEED XENDIT INVOICE:',
      needInvoice
    );

    console.log(
      'ITEMS:',
      JSON.stringify(items, null, 2)
    );

    if (!finalTableNumber) {
      return res.status(400).json({
        success: false,
        message:
          'Table number is required.',
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          'Order must contain items.',
      });
    }

    // =========================
    // COMPUTE TOTAL AMOUNT
    // =========================

    const totalAmount =
      items.reduce(
        (sum, item) => {
          const price =
            Number(item.price || 0);

          const quantity =
            Number(item.quantity || 0);

          return sum + price * quantity;
        },
        0
      );

    if (totalAmount < 0) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid order total amount.',
      });
    }

    if (
      totalAmount <= 0 &&
      !items.some((item) => {
        const notes =
          String(
            item.special_request ||
            item.notes ||
            ''
          ).trim();

        return notes.length > 0;
      })
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid order total amount.',
      });
    }

    // =========================
    // MOCK DATABASE
    // =========================

    if (!isConfigured) {
      const mockOrderId =
        db.orders.length + 1;

      const invoiceData = needInvoice
        ? {
            xendit_invoice_id:
              `mock_inv_${Math.random()
                .toString(36)
                .substring(2, 11)
                .toUpperCase()}`,
            xendit_external_id:
              buildMockExternalId(mockOrderId),
            xendit_invoice_url:
              `https://checkout-staging.xendit.co/web/mock_inv_${Date.now()}`,
            xendit_expiry_date:
              new Date(
                Date.now() +
                24 * 60 * 60 * 1000
              ).toISOString(),
          }
        : {
            xendit_invoice_id: null,
            xendit_external_id: null,
            xendit_invoice_url: null,
            xendit_expiry_date: null,
          };

      const newOrder = {
        id: mockOrderId,
        order_number:
          `ORD-${Date.now()}`,
        table_number:
          finalTableNumber,
        table_session_id: null,
        items,
        total_amount:
          totalAmount,
        status:
          needInvoice
            ? 'awaiting_payment'
            : newOrderStatus,
        payment_method:
          needInvoice
            ? 'Digital Payment'
            : paymentMethod,
        payment_status:
          'pending',
        paid_at: null,
        created_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
        ...invoiceData,
      };

      db.orders.push(newOrder);

      return res.status(201).json({
        success: true,
        message:
          'Order created successfully.',
        data: newOrder,
        order_id: newOrder.id,
        payment_status:
          newOrder.payment_status,
        payment_method:
          newOrder.payment_method,
        order_status:
          newOrder.status,
        invoice_url:
          newOrder.xendit_invoice_url,
        xendit_invoice_url:
          newOrder.xendit_invoice_url,
      });
    }

    // =========================
    // FIND RESTAURANT TABLE
    // =========================

    const {
      data: restaurantTable,
      error: tableError,
    } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq(
        'table_number',
        finalTableNumber
      )
      .single();

    if (tableError || !restaurantTable) {
      console.log(
        'RESTAURANT TABLE ERROR:',
        tableError
      );

      return res.status(404).json({
        success: false,
        message:
          `Table No. ${finalTableNumber} was not found in restaurant_tables.`,
      });
    }

    const tableStatus =
      normalizeTableStatus(
        restaurantTable.status
      );

    // =========================
    // FIND ACTIVE TABLE SESSION
    // =========================

    const {
      data: activeSession,
      error: sessionError,
    } = await supabase
      .from('table_sessions')
      .select('*')
      .eq(
        'restaurant_table_id',
        restaurantTable.id
      )
      .eq('status', 'active')
      .single();

    if (
      tableStatus !== 'occupied' ||
      sessionError ||
      !activeSession
    ) {
      console.log(
        'TABLE ASSIGNMENT ERROR:',
        sessionError
      );

      return res.status(403).json({
        success: false,
        message:
          TABLE_ASSIGNMENT_MESSAGE,
      });
    }

    // =========================
    // CHECK INVENTORY FIRST
    // =========================

    for (const item of items) {
      const menuItemId =
        item.menu_item_id ||
        item.id;

      const orderedQty =
        Number(item.quantity);

      if (
        !menuItemId ||
        !orderedQty ||
        orderedQty <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid order item quantity.',
        });
      }

      const {
        data: menuItem,
        error: menuItemError,
      } = await supabase
        .from('menu_items')
        .select('id, name, category')
        .eq('id', menuItemId)
        .single();

      if (menuItemError || !menuItem) {
        return res.status(404).json({
          success: false,
          message:
            'Menu item not found.',
        });
      }

      const isChefOppaSpecial =
        String(menuItem.category || '')
          .trim()
          .toLowerCase() ===
        'chef oppa special';

      if (isChefOppaSpecial) {
        continue;
      }

      const maxServings =
        await computeMaxServingsFromRecipes(
          supabase,
          menuItemId
        );

      if (maxServings <= 0) {
        return res.status(422).json({
          success: false,
          message:
            `${menuItem.name} is out of stock.`,
        });
      }

      if (orderedQty > maxServings) {
        return res.status(422).json({
          success: false,
          message:
            `${menuItem.name} only has ${maxServings} orders left.`,
        });
      }

      const {
        data: recipeRows,
        error: recipeError,
      } = await supabase
        .from('menu_item_ingredients')
        .select('*')
        .eq('menu_item_id', menuItemId);

      if (
        recipeError ||
        !recipeRows ||
        recipeRows.length === 0
      ) {
        return res.status(422).json({
          success: false,
          message:
            `${menuItem.name} is out of stock.`,
        });
      }

      for (const recipe of recipeRows) {
        const ingredientId =
          recipe.ingredient_id;

        const quantityRequired =
          Number(
            recipe.quantity_required
          );

        const totalNeeded =
          quantityRequired * orderedQty;

        const {
          data: ingredientRow,
          error: ingredientError,
        } = await supabase
          .from('ingredients')
          .select('id, name, current_stock')
          .eq('id', ingredientId)
          .single();

        if (ingredientError || !ingredientRow) {
          return res.status(400).json({
            success: false,
            message:
              `${menuItem.name} has missing ingredient data.`,
          });
        }

        const currentStock =
          Number(
            ingredientRow.current_stock
          );

        if (currentStock < totalNeeded) {
          return res.status(422).json({
            success: false,
            message:
              `Cannot place order. Not enough stock for ${ingredientRow.name}.`,
          });
        }
      }
    }

    // =========================
    // CREATE ORDER
    // =========================

    const orderNumber =
      `ORD-${Date.now()}`;

    const now =
      new Date().toISOString();

    const orderPayload = {
      order_number:
        orderNumber,
      table_number:
        finalTableNumber,
      table_session_id:
        activeSession.id,
      total_amount:
        totalAmount,
      status:
        needInvoice
          ? 'awaiting_payment'
          : newOrderStatus,
      payment_method:
        needInvoice
          ? 'Digital Payment'
          : paymentMethod,
      payment_status:
        'pending',
      paid_at:
        null,
      created_at:
        now,
      updated_at:
        now,
    };

    const {
      data: createdOrder,
      error: orderError,
    } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select(
        'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, paid_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
      )
      .single();

    if (orderError || !createdOrder) {
      console.log(
        'ORDER INSERT ERROR:',
        orderError
      );

      return res.status(500).json({
        success: false,
        message:
          orderError?.message ||
          'Failed to create order.',
      });
    }

    const orderId =
      createdOrder.id;

    // =========================
    // CREATE ORDER ITEMS
    // =========================

    const orderItemsPayload =
      items.map((item) => ({
        order_id: orderId,
        menu_item_id:
          item.menu_item_id ||
          item.id,
        quantity:
          Number(item.quantity),
        price:
          Number(item.price) || 0,
      }));

    console.log(
      'ORDER ITEMS PAYLOAD:',
      JSON.stringify(
        orderItemsPayload,
        null,
        2
      )
    );

    const {
      error: orderItemsError,
    } = await supabase
      .from('order_items')
      .insert(orderItemsPayload);

    if (orderItemsError) {
      console.log(
        'ORDER ITEMS ERROR:',
        orderItemsError
      );

      return res.status(500).json({
        success: false,
        message:
          orderItemsError.message,
      });
    }

    // =========================
    // UPDATE RESTAURANT TABLE
    // =========================

    const {
      error: tableUpdateError,
    } = await supabase
      .from('restaurant_tables')
      .update({
        current_order_id:
          orderId,
        notes:
          'Tablet order',
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'table_number',
        finalTableNumber
      );

    if (tableUpdateError) {
      console.log(
        'TABLE UPDATE ERROR:',
        tableUpdateError
      );

      return res.status(500).json({
        success: false,
        message:
          tableUpdateError.message ||
          'Order created but failed to update table assignment.',
      });
    }

    // =========================
    // INVENTORY DEDUCTION
    // =========================

    for (const item of items) {
      const menuItemId =
        item.menu_item_id ||
        item.id;

      const orderedQty =
        Number(item.quantity);

      const {
        data: menuItem,
        error: menuItemError,
      } = await supabase
        .from('menu_items')
        .select('id, category')
        .eq('id', menuItemId)
        .single();

      if (menuItemError || !menuItem) {
        continue;
      }

      const isChefOppaSpecial =
        String(menuItem.category || '')
          .trim()
          .toLowerCase() ===
        'chef oppa special';

      if (isChefOppaSpecial) {
        continue;
      }

      const {
        data: recipeRows,
        error: recipeError,
      } = await supabase
        .from('menu_item_ingredients')
        .select('*')
        .eq('menu_item_id', menuItemId);

      if (recipeError) {
        console.log(
          'RECIPE ERROR:',
          recipeError
        );

        continue;
      }

      for (const recipe of recipeRows || []) {
        const ingredientId =
          recipe.ingredient_id;

        const totalNeeded =
          Number(
            recipe.quantity_required
          ) * orderedQty;

        const {
          data: ingredientRow,
          error: ingredientError,
        } = await supabase
          .from('ingredients')
          .select('id,current_stock')
          .eq('id', ingredientId)
          .single();

        if (
          ingredientError ||
          !ingredientRow
        ) {
          console.log(
            'INGREDIENT ERROR:',
            ingredientError
          );

          continue;
        }

        const newStock =
          Number(
            ingredientRow.current_stock
          ) - totalNeeded;

        const {
          error: updateError,
        } = await supabase
          .from('ingredients')
          .update({
            current_stock:
              newStock,
          })
          .eq('id', ingredientId);

        if (updateError) {
          console.log(
            'INGREDIENT UPDATE ERROR:',
            updateError
          );
        }

        let remainingNeeded =
          totalNeeded;

        const {
          data: batchRows,
          error: batchError,
        } = await supabase
          .from('inventory_batches')
          .select('*')
          .eq(
            'ingredient_id',
            ingredientId
          )
          .eq('status', 'active')
          .order('received_date', {
            ascending: true,
          });

        if (batchError) {
          console.log(
            'BATCH ERROR:',
            batchError
          );

          continue;
        }

        for (const batch of batchRows || []) {
          if (remainingNeeded <= 0) {
            break;
          }

          const available =
            Number(
              batch.quantity_remaining
            );

          if (available <= 0) {
            continue;
          }

          const deductAmount =
            Math.min(
              available,
              remainingNeeded
            );

          const updatedRemaining =
            available - deductAmount;

          await supabase
            .from('inventory_batches')
            .update({
              quantity_remaining:
                updatedRemaining,
            })
            .eq('id', batch.id);

          remainingNeeded -=
            deductAmount;
        }

        const {
          error: usageError,
        } = await supabase
          .from('ingredient_usages')
          .insert({
            ingredient_id:
              ingredientId,
            order_id:
              orderId,
            quantity_used:
              totalNeeded,
          });

        if (usageError) {
          console.log(
            'USAGE ERROR:',
            usageError
          );
        }
      }
    }

    // =========================
    // CREATE XENDIT INVOICE
    // =========================

    if (needInvoice) {
      try {
        const invoice =
          await createInvoice(
            orderId,
            totalAmount,
            finalTableNumber
          );

        const invoiceUpdatePayload = {
          payment_method:
            'Digital Payment',
          payment_status:
            'pending',
          status:
            'awaiting_payment',
          xendit_invoice_id:
            invoice.id,
          xendit_external_id:
            invoice.external_id,
          xendit_invoice_url:
            invoice.invoice_url,
          updated_at:
            new Date().toISOString(),
        };

        if (invoice.expiry_date) {
          invoiceUpdatePayload.xendit_expiry_date =
            invoice.expiry_date;
        }

        const {
          data: updatedInvoiceOrder,
          error: updateOrderError,
        } = await supabase
          .from('orders')
          .update(invoiceUpdatePayload)
          .eq('id', orderId)
          .select(
            'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, paid_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
          )
          .single();

        if (updateOrderError) {
          console.log(
            'XENDIT ORDER UPDATE ERROR:',
            updateOrderError
          );

          return res.status(500).json({
            success: false,
            message:
              updateOrderError.message ||
              'Invoice created but failed to save invoice details.',
          });
        }

        createdOrder.payment_method =
          'Digital Payment';

        createdOrder.payment_status =
          updatedInvoiceOrder.payment_status;

        createdOrder.status =
          updatedInvoiceOrder.status;

        createdOrder.xendit_invoice_id =
          updatedInvoiceOrder.xendit_invoice_id;

        createdOrder.xendit_external_id =
          updatedInvoiceOrder.xendit_external_id;

        createdOrder.xendit_invoice_url =
          updatedInvoiceOrder.xendit_invoice_url;

        createdOrder.xendit_expiry_date =
          updatedInvoiceOrder.xendit_expiry_date;

        createdOrder.updated_at =
          updatedInvoiceOrder.updated_at;

        console.log(
          'XENDIT DETAILS SAVED TO ORDER:',
          {
            order_id:
              orderId,
            payment_method:
              createdOrder.payment_method,
            xendit_invoice_id:
              updatedInvoiceOrder.xendit_invoice_id,
            xendit_external_id:
              updatedInvoiceOrder.xendit_external_id,
            xendit_invoice_url:
              updatedInvoiceOrder.xendit_invoice_url,
          }
        );
      } catch (invoiceError) {
        console.log(
          'XENDIT INVOICE CREATION ERROR:',
          invoiceError.response?.data ||
          invoiceError.message ||
          invoiceError
        );

        return res.status(500).json({
          success: false,
          message:
            'Failed to initiate QR PH payment.',
          error:
            invoiceError.response?.data ||
            invoiceError.message ||
            String(invoiceError),
        });
      }
    }

    const fixedCreatedOrder =
      forceDigitalPaymentIfXendit(
        createdOrder
      );

    // =========================
    // SUCCESS RESPONSE
    // =========================

    return res.status(201).json({
      success: true,
      message:
        'Order created successfully.',
      data: {
        ...fixedCreatedOrder,
        items:
          orderItemsPayload,
        restaurant_table:
          restaurantTable,
        table_session:
          activeSession,
      },
      order_id:
        fixedCreatedOrder.id,
      payment_status:
        fixedCreatedOrder.payment_status,
      payment_method:
        fixedCreatedOrder.payment_method,
      order_status:
        fixedCreatedOrder.status,
      invoice_url:
        fixedCreatedOrder.xendit_invoice_url,
      xendit_invoice_url:
        fixedCreatedOrder.xendit_invoice_url,
      xendit_invoice_id:
        fixedCreatedOrder.xendit_invoice_id,
      xendit_external_id:
        fixedCreatedOrder.xendit_external_id,
      xendit_expiry_date:
        fixedCreatedOrder.xendit_expiry_date,
    });
  } catch (error) {
    console.error(
      'CREATE ORDER SERVER ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Server Error',
    });
  }
});

// =========================
// GET ORDER BY ID
// GET /api/orders/:id
// =========================

router.get('/:id', async (req, res) => {
  try {
    const orderId =
      parseInt(req.params.id);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid order id.',
      });
    }

    if (!isConfigured) {
      const order = db.orders.find(
        (o) =>
          Number(o.id) ===
          Number(orderId)
      );

      if (order) {
        return res.json({
          success: true,
          data:
            forceDigitalPaymentIfXendit(
              order
            ),
        });
      }

      return res.status(404).json({
        success: false,
        message: 'Not found',
      });
    }

    const {
      data: orderRow,
      error: orderError,
    } = await supabase
      .from('orders')
      .select(
        'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, paid_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
      )
      .eq('id', orderId)
      .single();

    if (orderError || !orderRow) {
      return res.status(404).json({
        success: false,
        message: 'Not found',
      });
    }

    let fixedOrderRow =
      forceDigitalPaymentIfXendit(
        orderRow
      );

    if (
      hasXenditInvoice(orderRow) &&
      orderRow.payment_method !==
        'Digital Payment'
    ) {
      const {
        data: correctedOrder,
        error: correctionError,
      } = await supabase
        .from('orders')
        .update({
          payment_method:
            'Digital Payment',
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', orderId)
        .select(
          'id, order_number, table_number, table_session_id, status, payment_status, payment_method, total_amount, created_at, updated_at, paid_at, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
        )
        .single();

      if (!correctionError && correctedOrder) {
        fixedOrderRow =
          correctedOrder;
      }
    }

    const {
      data: orderItems,
      error: itemsError,
    } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

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

    const enrichedItems =
      (orderItems || []).map((item) => {
        const menuItem =
          menuItems.find(
            (menu) =>
              Number(menu.id) ===
              Number(item.menu_item_id)
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

    return res.json({
      success: true,
      data: {
        ...fixedOrderRow,
        items: enrichedItems,
      },
      order_id:
        fixedOrderRow.id,
      payment_status:
        fixedOrderRow.payment_status,
      payment_method:
        fixedOrderRow.payment_method,
      order_status:
        fixedOrderRow.status,
      invoice_url:
        fixedOrderRow.xendit_invoice_url,
      xendit_invoice_url:
        fixedOrderRow.xendit_invoice_url,
      xendit_invoice_id:
        fixedOrderRow.xendit_invoice_id,
      xendit_external_id:
        fixedOrderRow.xendit_external_id,
      xendit_expiry_date:
        fixedOrderRow.xendit_expiry_date,
    });
  } catch (error) {
    console.log(
      'GET ORDER BY ID ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch order.',
    });
  }
});

module.exports = router;