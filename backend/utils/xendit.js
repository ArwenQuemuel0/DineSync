const XENDIT_SECRET_KEY =
  process.env.XENDIT_SECRET_KEY;

const XENDIT_SUCCESS_REDIRECT_URL =
  process.env.XENDIT_SUCCESS_REDIRECT_URL ||
  'http://localhost:3000/payment-success';

const XENDIT_FAILURE_REDIRECT_URL =
  process.env.XENDIT_FAILURE_REDIRECT_URL ||
  'http://localhost:3000/payment-failed';

/**
 * Creates a Xendit invoice for a given order.
 *
 * external_id format:
 * ORDER-{order_id}
 *
 * @param {string|number} orderId
 * @param {number} amount
 * @param {number|string} tableNumber
 * @returns {Promise<{id: string, external_id: string, invoice_url: string, expiry_date: string}>}
 */
async function createInvoice(
  orderId,
  amount,
  tableNumber
) {
  const externalId =
    `ORDER-${orderId}`;

  if (!XENDIT_SECRET_KEY) {
    throw new Error(
      'XENDIT_SECRET_KEY is missing in .env'
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

  console.log(
    `[XENDIT] Creating invoice for ${externalId}, Amount: ${amount}, Table: ${tableNumber}`
  );

  const payload = {
    external_id: externalId,
    amount: Number(amount),
    description:
      `DineSync Order #${orderId} (Table ${tableNumber})`,
    currency: 'PHP',
    invoice_duration: 86400,
    success_redirect_url:
      XENDIT_SUCCESS_REDIRECT_URL,
    failure_redirect_url:
      XENDIT_FAILURE_REDIRECT_URL,
  };

  const authHeader =
    'Basic ' +
    Buffer
      .from(`${XENDIT_SECRET_KEY}:`)
      .toString('base64');

  try {
    const response =
      await fetch(
        'https://api.xendit.co/v2/invoices',
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
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
        '[XENDIT] Failed to create invoice:',
        data
      );

      throw new Error(
        data.message ||
          data.error_code ||
          'Xendit Invoice API returned an error.'
      );
    }

    console.log(
      '[XENDIT] Invoice created successfully:',
      data.id
    );

    return {
      id: data.id,
      external_id: data.external_id,
      invoice_url: data.invoice_url,
      expiry_date: data.expiry_date,
    };
  } catch (error) {
    console.error(
      '[XENDIT] Request Exception:',
      error
    );

    throw error;
  }
}

module.exports = {
  createInvoice,
};