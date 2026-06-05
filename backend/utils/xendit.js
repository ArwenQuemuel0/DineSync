const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;

/**
 * Creates a Xendit invoice for a given order.
 * 
 * @param {string|number} orderId - The unique database order ID.
 * @param {number} amount - The total amount to bill.
 * @param {number|string} tableNumber - The table number making the order.
 * @returns {Promise<{id: string, external_id: string, invoice_url: string, expiry_date: string}>}
 */
async function createInvoice(orderId, amount, tableNumber) {
  const externalId = `ORDER-${orderId}`;
  
  if (!XENDIT_SECRET_KEY) {
    console.warn('⚠️ [XENDIT] XENDIT_SECRET_KEY is not set. Generating a mock invoice.');
    // Generate a mock response for local testing when credentials are not configured
    return {
      id: `mock_inv_${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
      external_id: externalId,
      invoice_url: `https://checkout-staging.xendit.co/web/mock_inv_${Date.now()}`,
      expiry_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours expiry
    };
  }

  console.log(`[XENDIT] Creating invoice for ${externalId}, Amount: ${amount}, Table: ${tableNumber}`);

  const payload = {
    external_id: externalId,
    amount: Number(amount),
    description: `DineSync Order #${orderId} (Table ${tableNumber})`,
    currency: 'PHP',
    invoice_duration: 86400 // 24 hours in seconds
  };

  const authHeader = 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64');

  try {
    const response = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[XENDIT] Failed to create invoice:', data);
      throw new Error(data.message || 'Xendit Invoice API returned error');
    }

    console.log('[XENDIT] Invoice created successfully:', data.id);
    
    return {
      id: data.id,
      external_id: data.external_id,
      invoice_url: data.invoice_url,
      expiry_date: data.expiry_date
    };
  } catch (error) {
    console.error('[XENDIT] Request Exception:', error);
    throw error;
  }
}

module.exports = {
  createInvoice
};
