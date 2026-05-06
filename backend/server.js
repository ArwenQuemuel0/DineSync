const express = require('express');
const cors = require('cors');

require('dotenv').config();

const app = express();

const PORT =
  process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const menuRoutes =
  require('./routes/menu');

const orderRoutes =
  require('./routes/orders');

const paymentRoutes =
  require('./routes/payments');

app.use('/api/menu', menuRoutes);

app.use('/api/orders', orderRoutes);

app.use(
  '/api/payments',
  paymentRoutes
);

app.get('/', (req, res) => {
  res.send(
    'DineSync+ API is running'
  );
});

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
// IMPORTANT FIX
app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `Server is running on port ${PORT}`
    );
  }
);