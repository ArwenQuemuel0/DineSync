const { createClient } = require('@supabase/supabase-js');

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY;

const isConfigured =
  !!supabaseUrl && !!supabaseKey;

if (!isConfigured) {
  console.log(
    'SUPABASE NOT CONFIGURED'
  );

  console.log(
    'SUPABASE_URL:',
    supabaseUrl
  );

  console.log(
    'SUPABASE KEY EXISTS:',
    !!supabaseKey
  );
} else {
  console.log(
    'SUPABASE CONNECTED TO:',
    supabaseUrl
  );
}

const supabase =
  isConfigured
    ? createClient(
        supabaseUrl,
        supabaseKey
      )
    : null;

module.exports = {
  supabase,
  isConfigured,
};