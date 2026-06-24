// =========================
// ORDER STATUS HELPERS
// =========================

export const normalizeOrderStatus = (status) => {
  const value = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, '_')
    .replace(/\s+/g, '_');

  if (value === 'awaiting_payment') {
    return 'awaiting_payment';
  }

  if (value === 'pending') {
    return 'pending';
  }

  if (value === 'preparing') {
    return 'preparing';
  }

  if (value === 'ready') {
    return 'ready';
  }

  if (value === 'served') {
    return 'served';
  }

  if (
    value === 'cancelled' ||
    value === 'canceled'
  ) {
    return 'cancelled';
  }

  return value || 'pending';
};

export const getOrderStatusLabel = (status) => {
  const normalized =
    normalizeOrderStatus(status);

  if (normalized === 'awaiting_payment') {
    return 'Awaiting Payment';
  }

  if (normalized === 'pending') {
    return 'Pending';
  }

  if (normalized === 'preparing') {
    return 'Preparing';
  }

  if (normalized === 'ready') {
    return 'Ready';
  }

  if (normalized === 'served') {
    return 'Served';
  }

  if (normalized === 'cancelled') {
    return 'Cancelled';
  }

  return 'Pending';
};

export const isActiveOrderStatus = (status) => {
  const normalized =
    normalizeOrderStatus(status);

  return [
    'pending',
    'preparing',
    'ready',
  ].includes(normalized);
};

export const isKdsVisibleOrderStatus = (status) => {
  const normalized =
    normalizeOrderStatus(status);

  return [
    'pending',
    'preparing',
    'ready',
  ].includes(normalized);
};

export const isAwaitingPaymentStatus = (status) => {
  return (
    normalizeOrderStatus(status) ===
    'awaiting_payment'
  );
};

// =========================
// PAYMENT STATUS HELPERS
// pending, paid, expired, failed
// =========================

export const normalizePaymentStatus = (paymentStatus) => {
  const value = String(paymentStatus || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, '_')
    .replace(/\s+/g, '_');

  if (value === 'paid') {
    return 'paid';
  }

  if (value === 'expired') {
    return 'expired';
  }

  if (value === 'failed') {
    return 'failed';
  }

  return 'pending';
};

export const getPaymentStatusLabel = (paymentStatus) => {
  const normalized =
    normalizePaymentStatus(paymentStatus);

  if (normalized === 'paid') {
    return 'Paid';
  }

  if (normalized === 'expired') {
    return 'Expired';
  }

  if (normalized === 'failed') {
    return 'Failed';
  }

  return 'Unpaid';
};

// =========================
// PAYMENT METHOD HELPERS
// =========================

export const normalizePaymentMethod = (paymentMethod) => {
  const value = String(paymentMethod || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (
    value === 'digital payment' ||
    value === 'qr ph' ||
    value === 'qrph' ||
    value === 'xendit' ||
    value === 'online payment'
  ) {
    return 'QR PH';
  }

  if (
    value === 'cash' ||
    value === 'cash paid'
  ) {
    return 'Cash';
  }

  if (
    value === 'pay at counter' ||
    value === 'counter' ||
    value === 'cashier'
  ) {
    return 'Pay at Counter';
  }

  if (
    value === 'pay later' ||
    value === 'later'
  ) {
    return 'Pay Later';
  }

  return paymentMethod || 'Pay Later';
};