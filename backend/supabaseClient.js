const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const isProbablyPlaceholder = (v) => {
  if (!v) return true;
  const s = String(v).trim().toLowerCase();
  return (
    s === '' ||
    s.includes('placeholder') ||
    s.includes('your_') ||
    s.includes('_here') ||
    s.endsWith('here')
  );
};

const isConfigured = !isProbablyPlaceholder(supabaseUrl) && !isProbablyPlaceholder(supabaseKey);

// If Supabase isn't configured, backend routes fall back to `mockDb.js`.
// This keeps the app runnable without needing secrets immediately.
const supabase = isConfigured ? createClient(supabaseUrl, supabaseKey) : null;

module.exports = {
  isConfigured,
  supabase,
};
