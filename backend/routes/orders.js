const express = require('express');

const router = express.Router();

const db = require('../mockDb');

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

router.post('/', async (req, res) => {
  try {
    const { items } = req.body;

    console.log(
      'REQ BODY:',
      JSON.stringify(
        req.body,
        null,
        2
      )
    );

    console.log(
      'ITEMS:',
      JSON.stringify(
        items,
        null,
        2
      )
    );

    if (
      !items ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Order must contain items',
      });
    }

    // =========================
    // MOCK DATABASE
    // =========================

    if (!isConfigured) {
      const newOrder = {
        id: db.orders.length + 1,
        items,
        status: 'Pending',
        createdAt:
          new Date().toISOString(),
      };

      db.orders.push(newOrder);

      return res.status(201).json({
        success: true,
        data: newOrder,
      });
    }

    // =========================
    // CREATE ORDER
    // =========================

    const orderNumber = `ORD-${Date.now()}`;

    const {
      data: orderRow,
      error: orderError,
    } = await supabase
      .from('orders')
      .insert({
        order_number:
          orderNumber,
        status: 'Pending',
      })
      .select(
        'id, status, order_number'
      )
      .single();

    if (orderError || !orderRow) {
      console.log(orderError);

      return res.status(500).json({
        success: false,
        message:
          orderError?.message ||
          'Failed to create order',
      });
    }

    const orderId = orderRow.id;

    // =========================
    // CREATE ORDER ITEMS
    // =========================

    const orderItemsPayload =
      items.map((i) => ({
        order_id: orderId,

        menu_item_id:
          i.menu_item_id,

        quantity: i.quantity,

        price: i.price || 0,
      }));

    console.log(
      'ORDER ITEMS PAYLOAD:',
      JSON.stringify(
        orderItemsPayload,
        null,
        2
      )
    );
    console.log(
      'INSERTING INTO ORDER_ITEMS:',
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
    // INVENTORY DEDUCTION
    // =========================

    for (const item of items) {
      const menuItemId =
        item.menu_item_id;

      const orderedQty =
        Number(item.quantity);

      // =========================
      // GET RECIPE INGREDIENTS
      // =========================

      const {
        data: recipeRows,
        error: recipeError,
      } = await supabase
        .from(
          'menu_item_ingredients'
        )
        .select('*')
        .eq(
          'menu_item_id',
          menuItemId
        );

      if (recipeError) {
        console.log(
          'RECIPE ERROR:',
          recipeError
        );

        continue;
      }

      console.log(
        'RECIPE ROWS:',
        recipeRows
      );

      for (const recipe of recipeRows) {
        const ingredientId =
          recipe.ingredient_id;

        const totalNeeded =
          Number(
            recipe.quantity_required
          ) * orderedQty;

        // =========================
        // GET INGREDIENT STOCK
        // =========================

        const {
          data: ingredientRow,
          error: ingredientError,
        } = await supabase
          .from('ingredients')
          .select(
            'id,current_stock'
          )
          .eq(
            'id',
            ingredientId
          )
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

        console.log(
          `Ingredient ${ingredientId} stock:`,
          ingredientRow.current_stock,
          '→',
          newStock
        );

        // =========================
        // UPDATE INGREDIENT STOCK
        // =========================

        const {
          error: updateError,
        } = await supabase
          .from('ingredients')
          .update({
            current_stock:
              newStock,
          })
          .eq(
            'id',
            ingredientId
          );

        if (updateError) {
          console.log(
            'UPDATE ERROR:',
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
          .from(
            'inventory_batches'
          )
          .select('*')
          .eq(
            'ingredient_id',
            ingredientId
          )
          .eq('status', 'active')
          .order(
            'received_date',
            {
              ascending: true,
            }
          );

        if (batchError) {
          console.log(
            'BATCH ERROR:',
            batchError
          );

          continue;
        }

        for (const batch of batchRows) {
          if (
            remainingNeeded <= 0
          )
            break;

          const available =
            Number(
              batch.quantity_remaining
            );

          if (available <= 0)
            continue;

          const deductAmount =
            Math.min(
              available,
              remainingNeeded
            );

          const updatedRemaining =
            available -
            deductAmount;

          console.log(
            `Batch ${batch.id}:`,
            available,
            '→',
            updatedRemaining
          );

          await supabase
            .from(
              'inventory_batches'
            )
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
          .from(
            'ingredient_usages'
          )
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
        id: orderId,
        status:
          orderRow.status,
        order_number:
          orderRow.order_number,
      },
    });
  } catch (error) {
    console.error(
      'SERVER ERROR:',
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

router.get('/:id', async (req, res) => {
  const orderId = parseInt(
    req.params.id
  );

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
      'id, status, order_number'
    )
    .eq('id', orderId)
    .single();

  if (
    orderError ||
    !orderRow
  ) {
    return res.status(404).json({
      success: false,
      message: 'Not found',
    });
  }

  return res.json({
    success: true,
    data: orderRow,
  });
});

module.exports = router;