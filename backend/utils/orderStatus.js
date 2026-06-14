// =========================
// ORDER STATUS HELPERS
// =========================

export const normalizeOrderStatus = (status) => {
    const value = String(status || '')
      .trim()
      .toLowerCase();
  
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
  
    if (value === 'cancelled' || value === 'canceled') {
      return 'cancelled';
    }
  
    return value || 'pending';
  };
  
  export const getOrderStatusLabel = (status) => {
    const normalized = normalizeOrderStatus(status);
  
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
    const normalized = normalizeOrderStatus(status);
  
    return [
      'pending',
      'preparing',
      'ready',
    ].includes(normalized);
  };
  
  // =========================
  // PAYMENT STATUS HELPERS
  // Required statuses:
  // pending, paid, expired, failed
  // =========================
  
  export const normalizePaymentStatus = (paymentStatus) => {
    const value = String(paymentStatus || '')
      .trim()
      .toLowerCase();
  
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
    const normalized = normalizePaymentStatus(paymentStatus);
  
    if (normalized === 'paid') {
      return 'Paid';
    }
  
    if (normalized === 'expired') {
      return 'Expired';
    }
  
    if (normalized === 'failed') {
      return 'Failed';
    }
  
    return 'Pending Payment';
  };