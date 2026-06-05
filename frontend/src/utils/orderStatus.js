export const normalizeOrderStatus = (
  status
) =>
  String(status || 'pending')
    .trim()
    .toLowerCase();

const ACTIVE_ORDER_STATUSES = new Set([
  'pending',
  'preparing',
  'ready',
]);

const INACTIVE_ORDER_STATUSES = new Set([
  'served',
  'completed',
  'cancelled',
  'canceled',
]);

export const isActiveOrderStatus = (
  status
) =>
  ACTIVE_ORDER_STATUSES.has(
    normalizeOrderStatus(status)
  );

export const isInactiveOrderStatus = (
  status
) =>
  INACTIVE_ORDER_STATUSES.has(
    normalizeOrderStatus(status)
  );

const toSentenceCase = (value) => {
  const text = String(value || '')
    .trim()
    .replace(/_/g, ' ')
    .toLowerCase();

  if (!text) {
    return 'Pending';
  }

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
};

export const getOrderStatusLabel = (
  status
) => {
  const normalized =
    normalizeOrderStatus(status);

  if (normalized === 'pending') {
    return 'Waiting for kitchen';
  }

  if (normalized === 'preparing') {
    return 'Preparing';
  }

  if (normalized === 'ready') {
    return 'Ready to serve';
  }

  if (
    normalized === 'served' ||
    normalized === 'completed'
  ) {
    return 'Served';
  }

  if (
    normalized === 'cancelled' ||
    normalized === 'canceled'
  ) {
    return 'Cancelled';
  }

  return toSentenceCase(status);
};
