const express = require('express');

const router = express.Router();

const db = require('../mockDb');

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

// =========================
// PROCESS PAYMENT
// POST /api/payments
// =========================

router.post('/', async (req, res) => {
  try {
    const {
      orderId,
      amount,
      paymentMethod,
    } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required.',
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment method is required.',
      });
    }

    const parsedOrderId =
      parseInt(orderId);

    const totalAmount =
      Number(amount) || 0;

    const referenceNumber =
      `TXN-${Math.random()
        .toString(36)
        .substr(2, 9)
        .toUpperCase()}`;

    // =========================
    // MOCK DATABASE
    // IMPORTANT:
    // Payment must NOT change order.status.
    // Order remains pending until KDS updates it.
    // =========================

    if (!isConfigured) {
      const order =
        db.orders.find(
          (o) =>
            Number(o.id) ===
            Number(parsedOrderId)
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found.',
        });
      }

      const newPayment = {
        id: db.payments.length + 1,
        order_id: parsedOrderId,
        payment_method: paymentMethod,
        amount: totalAmount,
        status: 'Paid',
        reference_number:
          referenceNumber,
        created_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      };

      db.payments.push(newPayment);

      // Do NOT do this:
      // order.status = 'Preparing';

      return res.status(201).json({
        success: true,
        data: newPayment,
      });
    }

    // =========================
    // CHECK ORDER EXISTS
    // =========================

    const {
      data: existingOrder,
      error: orderCheckError,
    } = await supabase
      .from('orders')
      .select(
        'id, status, table_number'
      )
      .eq('id', parsedOrderId)
      .single();

    if (
      orderCheckError ||
      !existingOrder
    ) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    // =========================
    // INSERT PAYMENT
    // IMPORTANT:
    // This only records payment.
    // It does NOT update orders.status.
    // =========================

    const now =
      new Date().toISOString();

    const paymentPayload = {
      order_id: parsedOrderId,
      payment_method: paymentMethod,
      amount: totalAmount,
      status: 'Paid',
      reference_number:
        referenceNumber,
      created_at: now,
      updated_at: now,
    };

    const {
      data: paymentRow,
      error: paymentError,
    } = await supabase
      .from('payments')
      .insert(paymentPayload)
      .select(
        'id, order_id, payment_method, amount, status, reference_number, created_at, updated_at'
      )
      .single();

    if (paymentError) {
      return res.status(500).json({
        success: false,
        message:
          paymentError.message,
      });
    }

    if (!paymentRow) {
      return res.status(500).json({
        success: false,
        message:
          'Failed to record payment.',
      });
    }

    // Do NOT do this:
    // await supabase
    //   .from('orders')
    //   .update({ status: 'Preparing' })
    //   .eq('id', parsedOrderId);

    return res.status(201).json({
      success: true,
      data: paymentRow,
    });
  } catch (error) {
    console.error(
      'PROCESS PAYMENT ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to process payment.',
    });
  }
});

module.exports = router;