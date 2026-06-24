const express = require('express');

const router = express.Router();

const db = require('../mockDb');

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

// =========================
// HELPERS
// =========================

const normalizePaymentMethod = (value) => {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');

  if (
    normalized === 'cash' ||
    normalized === 'cash paid' ||
    normalized === 'counter cash' ||
    normalized === 'pay at counter'
  ) {
    return 'Cash';
  }

  if (
    normalized === 'digital payment' ||
    normalized === 'qr ph' ||
    normalized === 'qrph' ||
    normalized === 'xendit' ||
    normalized === 'online payment'
  ) {
    return 'Digital Payment';
  }

  if (
    normalized === 'pay later' ||
    normalized === 'later'
  ) {
    return 'Pay Later';
  }

  return value || 'Cash';
};

const shouldMoveToKitchenAfterPayment = (status) => {
  const normalized =
    String(status || '')
      .trim()
      .toLowerCase();

  return normalized === 'awaiting_payment';
};

const extractOrderIdFromExternalId = (externalId) => {
  const value =
    String(externalId || '')
      .trim();

  // New required format:
  // ORDER-{order_id}-{timestamp}
  // Example:
  // ORDER-68-202606241806
  const newFormatMatch =
    value.match(/^ORDER-(\d+)-\d+$/);

  if (newFormatMatch?.[1]) {
    return Number(newFormatMatch[1]);
  }

  // Old fallback format:
  // ORDER-{order_id}
  const oldFormatMatch =
    value.match(/^ORDER-(\d+)$/);

  if (oldFormatMatch?.[1]) {
    return Number(oldFormatMatch[1]);
  }

  return null;
};

const mapXenditStatus = (status) => {
  const cleanStatus =
    String(status || '')
      .trim()
      .toUpperCase();

  if (
    cleanStatus === 'PAID' ||
    cleanStatus === 'SETTLED'
  ) {
    return 'paid';
  }

  if (cleanStatus === 'EXPIRED') {
    return 'expired';
  }

  if (
    cleanStatus === 'FAILED' ||
    cleanStatus === 'VOIDED' ||
    cleanStatus === 'CANCELED' ||
    cleanStatus === 'CANCELLED'
  ) {
    return 'failed';
  }

  return 'pending';
};

const getPayloadInvoiceUrl = (payload) => {
  return (
    payload.invoice_url ||
    payload.invoice_url_web ||
    payload.checkout_url ||
    null
  );
};

const getPayloadExpiryDate = (payload) => {
  return (
    payload.expiry_date ||
    payload.expiration_date ||
    payload.expires_at ||
    null
  );
};

// =========================
// PROCESS PAYMENT
// POST /api/payments
//
// Used by Service Staff Payments page.
// Cash settlement for Pay at Counter should:
// payment_method = "Cash"
// payment_status = "paid"
// paid_at = current datetime
// status = "pending" only if previous status was awaiting_payment
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

    const parsedOrderId =
      parseInt(orderId);

    if (!parsedOrderId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Order ID.',
      });
    }

    const normalizedPaymentMethod =
      normalizePaymentMethod(
        paymentMethod || 'Cash'
      );

    const totalAmount =
      Number(amount) || 0;

    const referenceNumber =
      `TXN-${Math.random()
        .toString(36)
        .substr(2, 9)
        .toUpperCase()}`;

    const now =
      new Date().toISOString();

    // =========================
    // MOCK DATABASE
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
        payment_method:
          normalizedPaymentMethod,
        amount:
          totalAmount ||
          Number(order.total_amount || 0),
        status: 'Paid',
        reference_number:
          referenceNumber,
        created_at: now,
        updated_at: now,
      };

      db.payments.push(newPayment);

      order.payment_method =
        normalizedPaymentMethod === 'Cash'
          ? 'Cash'
          : normalizedPaymentMethod;

      order.payment_status = 'paid';
      order.paid_at = now;
      order.updated_at = now;

      if (
        shouldMoveToKitchenAfterPayment(
          order.status
        )
      ) {
        order.status = 'pending';
      }

      return res.status(201).json({
        success: true,
        message:
          'Payment recorded successfully.',
        data: newPayment,
        order,
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
        'id, status, table_number, total_amount, payment_method, payment_status'
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
    // INSERT PAYMENT AUDIT RECORD
    // =========================

    const paymentPayload = {
      order_id: parsedOrderId,
      payment_method:
        normalizedPaymentMethod,
      amount:
        totalAmount ||
        Number(
          existingOrder.total_amount || 0
        ),
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

    // =========================
    // UPDATE ORDER PAYMENT
    //
    // IMPORTANT:
    // Do not change kitchen status except:
    // awaiting_payment -> pending after payment is confirmed.
    // =========================

    const orderUpdatePayload = {
      payment_method:
        normalizedPaymentMethod === 'Cash'
          ? 'Cash'
          : normalizedPaymentMethod,
      payment_status: 'paid',
      paid_at: now,
      updated_at: now,
    };

    if (
      shouldMoveToKitchenAfterPayment(
        existingOrder.status
      )
    ) {
      orderUpdatePayload.status =
        'pending';
    }

    const {
      data: updatedOrder,
      error: orderUpdateError,
    } = await supabase
      .from('orders')
      .update(orderUpdatePayload)
      .eq('id', parsedOrderId)
      .select(
        'id, order_number, table_number, status, payment_status, payment_method, paid_at, total_amount, created_at, updated_at'
      )
      .single();

    if (orderUpdateError) {
      return res.status(500).json({
        success: false,
        message:
          orderUpdateError.message,
      });
    }

    return res.status(201).json({
      success: true,
      message:
        'Payment recorded successfully.',
      data: paymentRow,
      order: updatedOrder,
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
//
// Backup/older webhook route.
//
// Recommended main webhook route:
// POST /api/webhooks/xendit
//
// This backup route also supports:
// ORDER-{order_id}-{timestamp}
// Example:
// ORDER-68-202606241806
//
// Digital Payment / QR PH rule:
// paid:
// payment_status = paid
// paid_at = current datetime
// status = pending only if current status is awaiting_payment
//
// expired/failed:
// payment_status only
// status remains awaiting_payment
// =========================

router.post('/webhook', async (req, res) => {
  try {
    const callbackToken =
      process.env.XENDIT_CALLBACK_TOKEN ||
      process.env.XENDIT_WEBHOOK_TOKEN;

    const headerToken =
      req.headers['x-callback-token'];

    if (
      callbackToken &&
      headerToken !== callbackToken
    ) {
      console.warn(
        '⚠️ [WEBHOOK] Callback token mismatch!'
      );

      return res.status(403).json({
        success: false,
        message: 'Invalid callback token.',
      });
    }

    const payload =
      req.body || {};

    const {
      id,
      external_id,
      status,
      amount,
    } = payload;

    console.log(
      `[WEBHOOK] Received callback for ${external_id}, Status: ${status}`
    );

    if (
      !external_id ||
      !String(external_id).startsWith('ORDER-')
    ) {
      console.log(
        '[WEBHOOK] Ignored callback (not an order invoice)'
      );

      return res.json({
        success: true,
        message: 'Ignored',
      });
    }

    const orderId =
      extractOrderIdFromExternalId(
        external_id
      );

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid external_id format.',
      });
    }

    const mappedStatus =
      mapXenditStatus(status);

    const now =
      new Date().toISOString();

    const xenditInvoiceId =
      id || null;

    const xenditInvoiceUrl =
      getPayloadInvoiceUrl(payload);

    const xenditExpiryDate =
      getPayloadExpiryDate(payload);

    console.log(
      '[WEBHOOK] Mapping Xendit invoice:',
      {
        order_id:
          orderId,
        external_id,
        xendit_invoice_id:
          xenditInvoiceId,
        raw_status:
          status,
        payment_status:
          mappedStatus,
      }
    );

    // =========================
    // MOCK DATABASE
    // =========================

    if (!isConfigured) {
      const order =
        db.orders.find(
          (o) =>
            Number(o.id) ===
            Number(orderId)
        );

      if (!order) {
        console.warn(
          `[WEBHOOK] Order ${orderId} not found in Mock DB.`
        );

        return res.status(404).json({
          success: false,
          message: 'Order not found.',
        });
      }

      order.payment_status =
        mappedStatus;

      order.xendit_invoice_id =
        xenditInvoiceId ||
        order.xendit_invoice_id ||
        null;

      order.xendit_external_id =
        external_id ||
        order.xendit_external_id ||
        null;

      order.xendit_invoice_url =
        xenditInvoiceUrl ||
        order.xendit_invoice_url ||
        null;

      order.xendit_expiry_date =
        xenditExpiryDate ||
        order.xendit_expiry_date ||
        null;

      order.updated_at = now;

      if (mappedStatus === 'paid') {
        order.payment_method =
          'Digital Payment';

        order.paid_at = now;

        if (
          shouldMoveToKitchenAfterPayment(
            order.status
          )
        ) {
          order.status = 'pending';
        }

        const alreadyPaid =
          db.payments.some(
            (p) =>
              Number(p.order_id) ===
              Number(orderId)
          );

        if (!alreadyPaid) {
          const newPayment = {
            id: db.payments.length + 1,
            order_id: orderId,
            payment_method:
              'Digital Payment',
            amount:
              Number(amount) ||
              Number(
                order.total_amount || 0
              ),
            status: 'Paid',
            reference_number:
              xenditInvoiceId ||
              `TXN-${Math.random()
                .toString(36)
                .substr(2, 9)
                .toUpperCase()}`,
            created_at: now,
            updated_at: now,
          };

          db.payments.push(newPayment);

          console.log(
            `[WEBHOOK] Recorded mock payment for Order ${orderId}`
          );
        }
      }

      return res.json({
        success: true,
        message:
          'Mock webhook processed successfully.',
        order_id:
          orderId,
        payment_status:
          mappedStatus,
        order_status:
          order.status,
        xendit_invoice_id:
          order.xendit_invoice_id,
        xendit_external_id:
          order.xendit_external_id,
      });
    }

    // =========================
    // LOOKUP ORDER
    // =========================

    const {
      data: existingOrder,
      error: orderLookupError,
    } = await supabase
      .from('orders')
      .select(
        'id, status, total_amount, table_number, payment_method, payment_status, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
      )
      .eq('id', orderId)
      .single();

    if (
      orderLookupError ||
      !existingOrder
    ) {
      console.warn(
        `[WEBHOOK] Order ${orderId} not found in Supabase.`
      );

      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    // =========================
    // UPDATE ORDER PAYMENT STATUS
    // and preserve/save Xendit invoice details.
    // =========================

    const orderUpdatePayload = {
      payment_status:
        mappedStatus,

      xendit_invoice_id:
        xenditInvoiceId ||
        existingOrder.xendit_invoice_id ||
        null,

      xendit_external_id:
        external_id ||
        existingOrder.xendit_external_id ||
        null,

      xendit_invoice_url:
        xenditInvoiceUrl ||
        existingOrder.xendit_invoice_url ||
        null,

      updated_at:
        now,
    };

    if (
      xenditExpiryDate ||
      existingOrder.xendit_expiry_date
    ) {
      orderUpdatePayload.xendit_expiry_date =
        xenditExpiryDate ||
        existingOrder.xendit_expiry_date;
    }

    if (mappedStatus === 'paid') {
      orderUpdatePayload.payment_method =
        'Digital Payment';

      orderUpdatePayload.paid_at =
        now;

      if (
        shouldMoveToKitchenAfterPayment(
          existingOrder.status
        )
      ) {
        orderUpdatePayload.status =
          'pending';
      }
    }

    const {
      data: updatedOrder,
      error: orderUpdateError,
    } = await supabase
      .from('orders')
      .update(orderUpdatePayload)
      .eq('id', orderId)
      .select(
        'id, order_number, table_number, status, payment_status, payment_method, paid_at, total_amount, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date, created_at, updated_at'
      )
      .single();

    if (orderUpdateError) {
      console.error(
        '[WEBHOOK] Failed to update order payment_status:',
        orderUpdateError
      );

      return res.status(500).json({
        success: false,
        message:
          orderUpdateError.message,
      });
    }

    console.log(
      '[WEBHOOK] Order updated:',
      {
        order_id:
          updatedOrder.id,
        status:
          updatedOrder.status,
        payment_status:
          updatedOrder.payment_status,
        xendit_invoice_id:
          updatedOrder.xendit_invoice_id,
        xendit_external_id:
          updatedOrder.xendit_external_id,
      }
    );

    // =========================
    // INSERT PAYMENT AUDIT RECORD IF PAID
    // =========================

    if (mappedStatus === 'paid') {
      const {
        data: existingPayment,
        error: paymentCheckError,
      } = await supabase
        .from('payments')
        .select('id')
        .eq('order_id', orderId)
        .limit(1);

      if (
        !paymentCheckError &&
        (
          !existingPayment ||
          existingPayment.length === 0
        )
      ) {
        const paymentPayload = {
          order_id:
            orderId,

          payment_method:
            'Digital Payment',

          amount:
            Number(amount) ||
            Number(
              existingOrder.total_amount || 0
            ),

          status:
            'Paid',

          reference_number:
            xenditInvoiceId ||
            `TXN-${Math.random()
              .toString(36)
              .substr(2, 9)
              .toUpperCase()}`,

          created_at:
            now,

          updated_at:
            now,
        };

        const {
          error: paymentInsertError,
        } = await supabase
          .from('payments')
          .insert(paymentPayload);

        if (paymentInsertError) {
          console.error(
            '[WEBHOOK] Failed to insert payment audit record:',
            paymentInsertError
          );
        } else {
          console.log(
            `[WEBHOOK] Recorded payment audit record for Order ${orderId}`
          );
        }
      }
    }

    return res.json({
      success: true,
      message:
        'Webhook processed successfully.',
      order_id:
        orderId,
      payment_status:
        mappedStatus,
      order_status:
        updatedOrder?.status,
      xendit_invoice_id:
        updatedOrder?.xendit_invoice_id,
      xendit_external_id:
        updatedOrder?.xendit_external_id,
      xendit_invoice_url:
        updatedOrder?.xendit_invoice_url,
      order:
        updatedOrder,
    });
  } catch (error) {
    console.error(
      '[WEBHOOK] Error handling Xendit webhook:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Internal server error.',
    });
  }
});

module.exports = router;