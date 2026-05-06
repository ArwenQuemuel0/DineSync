const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const { supabase, isConfigured } = require('../supabaseClient');

router.post('/', async (req, res) => {
  const { orderId, amount, paymentMethod } = req.body;

  if (!isConfigured) {
    const order = db.orders.find(o => o.id === parseInt(orderId));
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });

    const newPayment = {
      id: db.payments.length + 1,
      orderId,
      amount,
      paymentMethod,
      status: 'Paid',
      transactionId: `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    };
    db.payments.push(newPayment);
    order.status = 'Preparing'; // Set order status to preparing after payment
    return res.status(201).json({ success: true, data: newPayment });
  }

  const parsedOrderId = parseInt(orderId);
  const referenceNumber = `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  const { data: paymentRow, error: paymentError } = await supabase
    .from('payments')
    .insert({
      order_id: parsedOrderId,
      payment_method: paymentMethod,
      amount,
      status: 'Paid',
      reference_number: referenceNumber,
    })
    .select('id, order_id, payment_method, amount, status, reference_number')
    .single();

  if (paymentError) return res.status(500).json({ success: false, message: paymentError.message });
  if (!paymentRow) return res.status(500).json({ success: false, message: 'Failed to record payment' });

  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({ status: 'Preparing' })
    .eq('id', parsedOrderId);

  if (orderUpdateError) return res.status(500).json({ success: false, message: orderUpdateError.message });

  return res.status(201).json({ success: true, data: paymentRow });
});

module.exports = router;
