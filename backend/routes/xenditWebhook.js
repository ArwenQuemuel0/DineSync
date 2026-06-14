const express = require('express');

const router = express.Router();

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

const mapXenditInvoiceStatus = (status) => {
  const normalizedStatus =
    String(status || '').toUpperCase();

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

    const payload = req.body;

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
      Number(
        String(externalId).replace(
          'ORDER-',
          ''
        )
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

    if (!isConfigured) {
      return res.json({
        success: true,
        message:
          'Webhook received in mock mode.',
        order_id: orderId,
        payment_status:
          paymentStatus,
      });
    }

    const {
      error,
    } = await supabase
      .from('orders')
      .update({
        payment_status:
          paymentStatus,
        xendit_invoice_id:
          payload.id || null,
        xendit_external_id:
          externalId,
        xendit_invoice_url:
          payload.invoice_url || null,
        xendit_expiry_date:
          payload.expiry_date || null,
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      console.log(
        'XENDIT WEBHOOK UPDATE ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to update payment status.',
      });
    }

    return res.json({
      success: true,
      message:
        'Webhook processed.',
      order_id: orderId,
      payment_status:
        paymentStatus,
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