const express = require('express');

const router = express.Router();

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

// =========================
// DATE / TIME HELPERS
// IMPORTANT:
// Backend stores UTC.
// Mobile displays using Asia/Manila.
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
// STATUS MAPPER
// =========================

const mapXenditInvoiceStatus = (status) => {
  const normalizedStatus =
    String(status || '')
      .trim()
      .toUpperCase();

  if (
    normalizedStatus === 'PAID' ||
    normalizedStatus === 'SETTLED'
  ) {
    return 'paid';
  }

  if (normalizedStatus === 'EXPIRED') {
    return 'expired';
  }

  if (
    normalizedStatus === 'FAILED' ||
    normalizedStatus === 'VOIDED' ||
    normalizedStatus === 'CANCELED' ||
    normalizedStatus === 'CANCELLED'
  ) {
    return 'failed';
  }

  return 'pending';
};

// =========================
// HELPERS
// =========================

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

  // Backward compatibility:
  // ORDER-{order_id}
  const oldFormatMatch =
    value.match(/^ORDER-(\d+)$/);

  if (oldFormatMatch?.[1]) {
    return Number(oldFormatMatch[1]);
  }

  return null;
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
// XENDIT WEBHOOK CALLBACK
// POST /api/webhooks/xendit
// =========================

router.post('/xendit', async (req, res) => {
  try {
    const callbackToken =
      req.headers['x-callback-token'];

    if (
      process.env.XENDIT_WEBHOOK_TOKEN &&
      callbackToken !==
        process.env.XENDIT_WEBHOOK_TOKEN
    ) {
      return res.status(401).json({
        success: false,
        message:
          'Invalid Xendit callback token.',
      });
    }

    const payload =
      req.body || {};

    const externalId =
      payload.external_id;

    if (
      !externalId ||
      !String(externalId).startsWith('ORDER-')
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid external_id.',
      });
    }

    const orderId =
      extractOrderIdFromExternalId(
        externalId
      );

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid order id.',
      });
    }

    const paymentStatus =
      mapXenditInvoiceStatus(
        payload.status
      );

    const now =
      getUtcNowIso();

    const xenditInvoiceId =
      payload.id || null;

    const xenditInvoiceUrl =
      getPayloadInvoiceUrl(payload);

    const xenditExpiryDate =
      normalizeUtcIsoDate(
        getPayloadExpiryDate(payload)
      );

    console.log(
      'XENDIT WEBHOOK RECEIVED:',
      {
        order_id:
          orderId,
        external_id:
          externalId,
        xendit_invoice_id:
          xenditInvoiceId,
        raw_status:
          payload.status,
        payment_status:
          paymentStatus,
      }
    );

    // =========================
    // MOCK MODE
    // =========================

    if (!isConfigured) {
      return res.json({
        success: true,
        message:
          'Webhook received in mock mode.',
        order_id:
          orderId,
        payment_status:
          paymentStatus,
        xendit_invoice_id:
          xenditInvoiceId,
        xendit_external_id:
          externalId,
      });
    }

    // =========================
    // GET EXISTING ORDER FIRST
    //
    // Needed para hindi basta-basta galawin kitchen status.
    // Only awaiting_payment -> pending kapag paid.
    // =========================

    const {
      data: existingOrder,
      error: orderLookupError,
    } = await supabase
      .from('orders')
      .select(
        'id, status, total_amount, payment_method, payment_status, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date'
      )
      .eq('id', orderId)
      .single();

    if (
      orderLookupError ||
      !existingOrder
    ) {
      console.log(
        'XENDIT WEBHOOK ORDER LOOKUP ERROR:',
        orderLookupError
      );

      return res.status(404).json({
        success: false,
        message:
          'Order not found.',
      });
    }

    // =========================
    // BUILD ORDER UPDATE
    //
    // paid:
    // payment_status = paid
    // paid_at = now
    // status = pending only if current status is awaiting_payment
    //
    // expired/failed:
    // payment_status only
    // status remains awaiting_payment
    // =========================

    const orderUpdatePayload = {
      payment_status:
        paymentStatus,

      xendit_invoice_id:
        xenditInvoiceId ||
        existingOrder.xendit_invoice_id ||
        null,

      xendit_external_id:
        externalId ||
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
        normalizeUtcIsoDate(
          existingOrder.xendit_expiry_date
        );
    }

    if (paymentStatus === 'paid') {
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
      error: updateError,
    } = await supabase
      .from('orders')
      .update(orderUpdatePayload)
      .eq('id', orderId)
      .select(
        'id, order_number, table_number, status, payment_status, payment_method, paid_at, total_amount, xendit_invoice_id, xendit_external_id, xendit_invoice_url, xendit_expiry_date, created_at, updated_at'
      )
      .single();

    if (updateError) {
      console.log(
        'XENDIT WEBHOOK UPDATE ERROR:',
        updateError
      );

      return res.status(500).json({
        success: false,
        message:
          updateError.message ||
          'Failed to update payment status.',
      });
    }

    const normalizedUpdatedOrder =
      normalizeDateFields(
        updatedOrder
      );

    console.log(
      'XENDIT WEBHOOK ORDER UPDATED:',
      {
        order_id:
          normalizedUpdatedOrder.id,
        status:
          normalizedUpdatedOrder.status,
        payment_status:
          normalizedUpdatedOrder.payment_status,
        xendit_invoice_id:
          normalizedUpdatedOrder.xendit_invoice_id,
        xendit_external_id:
          normalizedUpdatedOrder.xendit_external_id,
      }
    );

    // =========================
    // INSERT PAYMENT AUDIT RECORD IF PAID
    // =========================

    if (paymentStatus === 'paid') {
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
            Number(payload.amount) ||
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
          console.log(
            'XENDIT WEBHOOK PAYMENT INSERT ERROR:',
            paymentInsertError
          );
        } else {
          console.log(
            'XENDIT PAYMENT AUDIT SAVED:',
            {
              order_id:
                orderId,
              reference_number:
                paymentPayload.reference_number,
            }
          );
        }
      }
    }

    return res.json({
      success: true,
      message:
        'Webhook processed.',
      order_id:
        orderId,
      payment_status:
        paymentStatus,
      order_status:
        normalizedUpdatedOrder?.status,
      xendit_invoice_id:
        normalizedUpdatedOrder?.xendit_invoice_id,
      xendit_external_id:
        normalizedUpdatedOrder?.xendit_external_id,
      xendit_invoice_url:
        normalizedUpdatedOrder?.xendit_invoice_url,
      order:
        normalizedUpdatedOrder,
    });
  } catch (error) {
    console.log(
      'XENDIT WEBHOOK ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Webhook processing failed.',
    });
  }
});

module.exports = router;