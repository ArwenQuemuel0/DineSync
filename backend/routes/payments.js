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


// =========================
// XENDIT WEBHOOK CALLBACK
// POST /api/payments/webhook
// =========================

router.post('/webhook', async (req, res) => {
  try {
    const callbackToken = process.env.XENDIT_CALLBACK_TOKEN;
    const headerToken = req.headers['x-callback-token'];

    if (callbackToken && headerToken !== callbackToken) {
      console.warn('⚠️ [WEBHOOK] Callback token mismatch!');
      return res.status(403).json({
        success: false,
        message: 'Invalid callback token.'
      });
    }

    const { id, external_id, status, amount } = req.body;
    console.log(`[WEBHOOK] Received callback for ${external_id}, Status: ${status}`);

    if (!external_id || !external_id.startsWith('ORDER-')) {
      console.log('[WEBHOOK] Ignored callback (not an order invoice)');
      return res.json({ success: true, message: 'Ignored' });
    }

    const orderId = parseInt(external_id.replace('ORDER-', ''));
    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid external_id format.' });
    }

    // Map Xendit status to order payment_status
    // Required statuses: pending, paid, expired, failed
    let mappedStatus = 'pending';
    const cleanStatus = String(status || '').toUpperCase();
    if (cleanStatus === 'PAID' || cleanStatus === 'SETTLED') {
      mappedStatus = 'paid';
    } else if (cleanStatus === 'EXPIRED') {
      mappedStatus = 'expired';
    } else if (cleanStatus === 'FAILED') {
      mappedStatus = 'failed';
    }

    console.log(`[WEBHOOK] Mapping Xendit status "${status}" to payment_status "${mappedStatus}" for Order ${orderId}`);

    // Update in Mock DB if Supabase is not configured
    if (!isConfigured) {
      const order = db.orders.find(o => o.id === orderId);
      if (!order) {
        console.warn(`[WEBHOOK] Order ${orderId} not found in Mock DB.`);
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      order.payment_status = mappedStatus;
      // Do NOT change order.status! Keep it pending.

      // Record in mock payments if paid
      if (mappedStatus === 'paid') {
        const alreadyPaid = db.payments.some(p => p.order_id === orderId);
        if (!alreadyPaid) {
          const newPayment = {
            id: db.payments.length + 1,
            order_id: orderId,
            payment_method: 'Xendit',
            amount: Number(amount) || order.total_amount || 0,
            status: 'Paid',
            reference_number: id || `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          db.payments.push(newPayment);
          console.log(`[WEBHOOK] Recorded mock payment for Order ${orderId}`);
        }
      }

      return res.json({ success: true, message: 'Mock webhook processed successfully.' });
    }

    // Update in Supabase
    // 1. Get current order to ensure it exists
    const { data: existingOrder, error: orderLookupError } = await supabase
      .from('orders')
      .select('id, total_amount, table_number')
      .eq('id', orderId)
      .single();

    if (orderLookupError || !existingOrder) {
      console.warn(`[WEBHOOK] Order ${orderId} not found in Supabase.`);
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // 2. Update payment_status (do NOT alter order.status!)
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        payment_status: mappedStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      console.error('[WEBHOOK] Failed to update order payment_status:', orderUpdateError);
      return res.status(500).json({ success: false, message: orderUpdateError.message });
    }

    // 3. Insert record in payments table if paid
    if (mappedStatus === 'paid') {
      // Check if payment already exists
      const { data: existingPayment, error: paymentCheckError } = await supabase
        .from('payments')
        .select('id')
        .eq('order_id', orderId)
        .limit(1);

      if (!paymentCheckError && (!existingPayment || existingPayment.length === 0)) {
        const now = new Date().toISOString();
        const paymentPayload = {
          order_id: orderId,
          payment_method: 'Xendit',
          amount: Number(amount) || existingOrder.total_amount || 0,
          status: 'Paid',
          reference_number: id || `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          created_at: now,
          updated_at: now
        };

        const { error: paymentInsertError } = await supabase
          .from('payments')
          .insert(paymentPayload);

        if (paymentInsertError) {
          console.error('[WEBHOOK] Failed to insert payment audit record:', paymentInsertError);
          // Don't fail the webhook response since the order status was already updated
        } else {
          console.log(`[WEBHOOK] Recorded payment audit record for Order ${orderId}`);
        }
      }
    }

    return res.json({
      success: true,
      message: 'Webhook processed successfully.'
    });
  } catch (error) {
    console.error('[WEBHOOK] Error handling Xendit webhook:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error.'
    });
  }
});

module.exports = router;