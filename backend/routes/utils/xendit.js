// =========================
// XENDIT CONFIG HELPERS
// =========================

const APP_TIME_ZONE =
  process.env.APP_TIMEZONE ||
  process.env.TZ ||
  'Asia/Manila';

const getXenditSecretKey = () => {
  return process.env.XENDIT_SECRET_KEY;
};

const getSuccessRedirectUrl = () => {
  return (
    process.env.XENDIT_SUCCESS_REDIRECT_URL ||
    'http://localhost:3000/payment-success'
  );
};

const getFailureRedirectUrl = () => {
  return (
    process.env.XENDIT_FAILURE_REDIRECT_URL ||
    'http://localhost:3000/payment-failed'
  );
};

// =========================
// SAFE KEY FINGERPRINT
// Do not log the full key.
// =========================

const getKeyFingerprint = () => {
  const key =
    String(getXenditSecretKey() || '');

  if (!key) {
    return {
      exists: false,
      prefix: null,
      last4: null,
      length: 0,
    };
  }

  return {
    exists: true,
    prefix:
      key.startsWith('xnd_development')
        ? 'xnd_development'
        : key.startsWith('xnd_production')
          ? 'xnd_production'
          : key.slice(0, 8),
    last4:
      key.slice(-4),
    length:
      key.length,
  };
};

// =========================
// MANILA TIMESTAMP HELPER
// Required format:
// YYYYMMDDHHmm
// =========================

const getManilaTimestamp = () => {
  const parts =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          APP_TIME_ZONE,
        year:
          'numeric',
        month:
          '2-digit',
        day:
          '2-digit',
        hour:
          '2-digit',
        minute:
          '2-digit',
        hour12:
          false,
      }
    ).formatToParts(new Date());

  const getPart = (type) => {
    return (
      parts.find(
        (part) =>
          part.type === type
      )?.value || ''
    );
  };

  const year =
    getPart('year');

  const month =
    getPart('month');

  const day =
    getPart('day');

  const hour =
    getPart('hour');

  const minute =
    getPart('minute');

  return `${year}${month}${day}${hour}${minute}`;
};

// =========================
// BUILD EXTERNAL ID
// Required format:
// ORDER-{order_id}-{timestamp}
//
// Example:
// ORDER-68-202606241806
// =========================

const buildExternalId = (orderId) => {
  const timestamp =
    getManilaTimestamp();

  return `ORDER-${orderId}-${timestamp}`;
};

// =========================
// DATE NORMALIZER
// Keep Xendit expiry date safe as ISO UTC
// =========================

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

// =========================
// CREATE XENDIT INVOICE
//
// Must save ACTUAL Xendit response:
// xendit_invoice_id = data.id
// xendit_external_id = data.external_id
// xendit_invoice_url = data.invoice_url
// xendit_expiry_date = data.expiry_date
// =========================

async function createInvoice(
  orderId,
  amount,
  tableNumber
) {
  const XENDIT_SECRET_KEY =
    getXenditSecretKey();

  if (!XENDIT_SECRET_KEY) {
    throw new Error(
      'XENDIT_SECRET_KEY is missing in Node backend .env'
    );
  }

  if (!orderId) {
    throw new Error(
      'Order ID is required to create Xendit invoice.'
    );
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error(
      'Valid amount is required to create Xendit invoice.'
    );
  }

  const externalId =
    buildExternalId(orderId);

  console.log(
    '[XENDIT] KEY CHECK:',
    getKeyFingerprint()
  );

  console.log(
    '[XENDIT] Creating QR PH invoice:',
    {
      order_id:
        orderId,
      external_id_sent_to_xendit:
        externalId,
      amount:
        Number(amount),
      table_number:
        tableNumber,
      timezone:
        APP_TIME_ZONE,
    }
  );

  const payload = {
    external_id:
      externalId,

    amount:
      Number(amount),

    description:
      `DineSync QR PH Payment - Order #${orderId} (Table ${tableNumber})`,

    currency:
      'PHP',

    invoice_duration:
      86400,

    success_redirect_url:
      getSuccessRedirectUrl(),

    failure_redirect_url:
      getFailureRedirectUrl(),

    payment_methods: [
      'QRPH',
    ],
  };

  const authHeader =
    'Basic ' +
    Buffer
      .from(`${XENDIT_SECRET_KEY}:`)
      .toString('base64');

  const response =
    await fetch(
      'https://api.xendit.co/v2/invoices',
      {
        method: 'POST',
        headers: {
          Authorization:
            authHeader,

          'Content-Type':
            'application/json',
        },
        body:
          JSON.stringify(payload),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    console.error(
      '[XENDIT] Failed to create QR PH invoice:',
      data
    );

    throw new Error(
      data?.message ||
        data?.error_code ||
        'Xendit Invoice API returned an error.'
    );
  }

  if (!data?.id) {
    throw new Error(
      'Xendit invoice response is missing id.'
    );
  }

  if (!data?.external_id) {
    throw new Error(
      'Xendit invoice response is missing external_id.'
    );
  }

  if (!data?.invoice_url) {
    throw new Error(
      'Xendit invoice response is missing invoice_url.'
    );
  }

  if (data.external_id !== externalId) {
    console.error(
      '[XENDIT] External ID mismatch:',
      {
        sent_external_id:
          externalId,
        response_external_id:
          data.external_id,
      }
    );

    throw new Error(
      'Xendit external_id mismatch. Refusing to save invoice.'
    );
  }

  const normalizedExpiryDate =
    normalizeUtcIsoDate(
      data.expiry_date
    );

  console.log(
    '[XENDIT] Invoice created successfully. SAVE THESE EXACT VALUES:',
    {
      xendit_invoice_id:
        data.id,
      xendit_external_id:
        data.external_id,
      xendit_invoice_url:
        data.invoice_url,
      xendit_expiry_date:
        normalizedExpiryDate,
    }
  );

  return {
    id:
      data.id,

    external_id:
      data.external_id,

    invoice_url:
      data.invoice_url,

    expiry_date:
      normalizedExpiryDate,
  };
}

module.exports = {
  createInvoice,
  buildExternalId,
  getKeyFingerprint,
};