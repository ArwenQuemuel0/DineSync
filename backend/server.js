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

app.use(
  express.json({
    limit: '10mb',
  })
);

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

app.use('/api/payments', paymentRoutes);

app.use('/api/table', tableRoutes);

app.use('/api/ai', aiRoutes);

// =========================
// XENDIT WEBHOOK ROUTE
//
// Recommended webhook URL:
// POST /api/webhooks/xendit
//
// Note:
// /api/payments/webhook also exists inside routes/payments.js
// as a fallback/older webhook route.
// =========================

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
// PAYMENT REDIRECT ROUTES
//
// These are landing routes after Xendit payment.
// Mobile WebView detects these URLs.
//
// In .env:
// XENDIT_SUCCESS_REDIRECT_URL=http://YOUR_IP_OR_DOMAIN:3000/payment-success
// XENDIT_FAILURE_REDIRECT_URL=http://YOUR_IP_OR_DOMAIN:3000/payment-failed
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

app.get('/api/version', (req, res) => {
  return res.json({
    success: true,
    version: 'with-ai-nutrition-route-2026-07-12',
    api: 'DineSync+ Node API',
    time: new Date().toISOString(),
  });
});

app.get('/api/ai-health', (req, res) => {
  return res.json({
    success: true,
    message: 'AI route mount is loaded',
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
    time: new Date().toISOString(),
  });
});

// =========================
// 404 FALLBACK
// =========================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found.',
    path: req.originalUrl,
  });
});

// =========================
// START SERVER
// =========================

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    const publicBaseUrl =
      process.env.PUBLIC_BASE_URL || 'https://api.dinesync.shop';

    console.log(
      `Server is running on port ${PORT}`
    );

    console.log(
      `API Base URL: ${publicBaseUrl}/api`
    );

    console.log(
      `Xendit Webhook URL: ${publicBaseUrl}/api/webhooks/xendit`
    );
  }
);