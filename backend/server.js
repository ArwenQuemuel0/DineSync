const express = require('express');
const cors = require('cors');

require('dotenv').config();

const app = express();

const PORT =
  process.env.PORT || 3000;

// =========================
// MIDDLEWARE
// =========================

app.use(cors());
app.use(express.json());

// =========================
// ROUTES
// =========================

const authRoutes =
  require('./routes/auth');

const menuRoutes =
  require('./routes/menu');

const orderRoutes =
  require('./routes/orders');

const paymentRoutes =
  require('./routes/payments');

const tableRoutes =
  require('./routes/table');

const aiRoutes =
  require('./routes/ai');

const xenditWebhookRoutes =
  require('./routes/xenditWebhook');

// =========================
// API ROUTES
// =========================

app.use('/api', authRoutes);

app.use('/api/menu', menuRoutes);

app.use('/api/orders', orderRoutes);

app.use(
  '/api/payments',
  paymentRoutes
);

app.use(
  '/api/table',
  tableRoutes
);

app.use(
  '/api/ai',
  aiRoutes
);

app.use(
  '/api/webhooks',
  xenditWebhookRoutes
);

// =========================
// DEFAULT ROUTE
// =========================

app.get('/', (req, res) => {
  res.send(
    'DineSync+ API is running'
  );
});

// =========================
// TEST ROUTE
// =========================

app.post('/test', (req, res) => {
  console.log('TEST ROUTE HIT');

  console.log(
    JSON.stringify(
      req.body,
      null,
      2
    )
  );

  return res.json({
    success: true,
    message:
      'Backend reached successfully',
  });
});

// =========================
// PAYMENT REDIRECT TEST ROUTES
// These are only landing routes after Xendit payment.
// Mobile WebView will detect these URLs.
// =========================

app.get('/payment-success', (req, res) => {
  res.send(
    'Payment success. You may now return to DineSync+.'
  );
});

app.get('/payment-failed', (req, res) => {
  res.send(
    'Payment failed or cancelled. You may now return to DineSync+.'
  );
});

// =========================
// START SERVER
// =========================

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `Server is running on port ${PORT}`
    );
  }
);