const APP_TIME_ZONE =
  process.env.EXPO_PUBLIC_APP_TIMEZONE || 'Asia/Manila';

const toDateObject = (value) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
};

export const formatDatePH = (value) => {
  const date = toDateObject(value);

  if (!date) return '—';

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: APP_TIME_ZONE,
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
};

export const formatTimePH = (value) => {
  const date = toDateObject(value);

  if (!date) return '—';

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: APP_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

export const formatDateTimePH = (value) => {
  const date = toDateObject(value);

  if (!date) return '—';

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: APP_TIME_ZONE,
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};