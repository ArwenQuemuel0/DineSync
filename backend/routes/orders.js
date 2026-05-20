const express = require('express');

const router = express.Router();

const db = require('../mockDb');

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

// =========================
// DEFAULT IPAD TABLE
// =========================

const DEFAULT_TABLE_NUMBER = 1;

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
          db.orders.filter((order) => {
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
          });

        return res.json({
          success: true,
          data: activeOrders,
        });
      }

      const {
        data: orders,
        error: ordersError,
      } = await supabase
        .from('orders')
        .select(
          'id, order_number, table_number, table_session_id, status, total_amount, created_at, updated_at'
        )
        .eq(
          'table_number',
          tableNumber
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

                  return {
                    ...item,
                    name:
                      item.name ||
                      menuItem?.name ||
                      'Menu Item',
                    price:
                      Number(
                        item.price ||
                          menuItem?.price ||
                          0
                      ),
                    subtotal:
                      Number(item.quantity || 0) *
                      Number(
                        item.price ||
                          menuItem?.price ||
                          0
                      ),
                    menu_item:
                      menuItem || null,
                  };
                });

            return {
              ...order,
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

    console.log(
      'REQ BODY:',
      JSON.stringify(req.body, null, 2)
    );

    console.log(
      'TABLE NUMBER:',
      finalTableNumber
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

    const newOrderStatus = 'pending';

    // =========================
    // MOCK DATABASE
    // =========================

    if (!isConfigured) {
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

      const newOrder = {
        id: db.orders.length + 1,
        order_number:
          `ORD-${Date.now()}`,
        table_number:
          finalTableNumber,
        table_session_id: null,
        items,
        status: newOrderStatus,
        total_amount: totalAmount,
        created_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      };

      db.orders.push(newOrder);

      return res.status(201).json({
        success: true,
        data: newOrder,
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

    if (sessionError || !activeSession) {
      console.log(
        'ACTIVE SESSION ERROR:',
        sessionError
      );

      return res.status(400).json({
        success: false,
        message:
          'No active table session found for this table.',
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
        .select('id, name')
        .eq('id', menuItemId)
        .single();

      if (menuItemError || !menuItem) {
        return res.status(404).json({
          success: false,
          message:
            'Menu item not found.',
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
        return res.status(400).json({
          success: false,
          message:
            `${menuItem.name} has no recipe/inventory setup.`,
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
          return res.status(400).json({
            success: false,
            message:
              `${menuItem.name} is no longer available in the requested quantity.`,
          });
        }
      }
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

    // =========================
    // CREATE ORDER
    // IMPORTANT:
    // Always force new orders to pending.
    // Always save active table_session_id.
    // =========================

    const orderNumber =
      `ORD-${Date.now()}`;

    const now =
      new Date().toISOString();

    const orderPayload = {
      order_number: orderNumber,
      table_number:
        finalTableNumber,
      table_session_id:
        activeSession.id,
      status: newOrderStatus,
      total_amount:
        totalAmount,
      created_at: now,
      updated_at: now,
    };

    const {
      data: createdOrder,
      error: orderError,
    } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select(
        'id, order_number, table_number, table_session_id, status, total_amount, created_at, updated_at'
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
        status: 'occupied',
        current_order_id:
          orderId,
        occupied_at:
          new Date().toISOString(),
        notes:
          'Tablet order',
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

        // =========================
        // FIFO BATCH DEDUCTION
        // =========================

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

        // =========================
        // LOG INGREDIENT USAGE
        // =========================

        const {
          error: usageError,
        } = await supabase
          .from('ingredient_usages')
          .insert({
            ingredient_id:
              ingredientId,
            order_id: orderId,
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
    // SUCCESS RESPONSE
    // =========================

    return res.status(201).json({
      success: true,
      data: {
        ...createdOrder,
        items:
          orderItemsPayload,
        restaurant_table:
          restaurantTable,
        table_session:
          activeSession,
      },
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
// =========================

router.get('/:id', async (req, res) => {
  try {
    const orderId =
      parseInt(req.params.id);

    if (!isConfigured) {
      const order = db.orders.find(
        (o) => o.id === orderId
      );

      if (order) {
        return res.json({
          success: true,
          data: order,
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
        'id, order_number, table_number, table_session_id, status, total_amount, created_at, updated_at'
      )
      .eq('id', orderId)
      .single();

    if (orderError || !orderRow) {
      return res.status(404).json({
        success: false,
        message: 'Not found',
      });
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

        return {
          ...item,
          name:
            item.name ||
            menuItem?.name ||
            'Menu Item',
          price:
            Number(
              item.price ||
                menuItem?.price ||
                0
            ),
          subtotal:
            Number(item.quantity || 0) *
            Number(
              item.price ||
                menuItem?.price ||
                0
            ),
          menu_item:
            menuItem || null,
        };
      });

    return res.json({
      success: true,
      data: {
        ...orderRow,
        items: enrichedItems,
      },
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