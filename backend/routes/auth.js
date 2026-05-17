const express = require('express');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// =========================
// SUPABASE CONNECTION
// =========================

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY;

const supabase =
  createClient(
    supabaseUrl,
    supabaseKey
  );

// =========================
// TABLE ACCOUNT PASSWORD
// =========================

const TABLE_ACCOUNT_PASSWORD =
  'dinesync123';

// =========================
// CHECK TABLE ACCOUNT EMAIL
// =========================

const getTableNumberFromEmail = (
  email
) => {
  const match =
    String(email || '')
      .toLowerCase()
      .match(
        /^table([1-8])@dinesync\.com$/
      );

  if (!match) {
    return null;
  }

  return Number(match[1]);
};

// =========================
// LOGIN
// POST /api/login
// =========================

router.post('/login', async (req, res) => {
  try {
    console.log('POST /api/login HIT');

    const { email, password } =
      req.body;

    console.log(
      'LOGIN EMAIL:',
      email
    );

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          'Email and password are required.',
      });
    }

    const cleanEmail =
      String(email)
        .trim()
        .toLowerCase();

    const tableNumberFromEmail =
      getTableNumberFromEmail(
        cleanEmail
      );

    const {
      data: user,
      error,
    } = await supabase
      .from('users')
      .select(
        'id, name, email, password, role, table_number, is_online, last_seen_at'
      )
      .eq('email', cleanEmail)
      .single();

    if (error || !user) {
      console.log(
        'LOGIN USER NOT FOUND:',
        error
      );

      return res.status(401).json({
        success: false,
        message:
          'Invalid email or password.',
      });
    }

    console.log(
      'LOGIN USER FOUND:',
      {
        id: user.id,
        email: user.email,
        role: user.role,
        table_number:
          user.table_number,
      }
    );

    if (
      user.role !== 'table_customer'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Only table accounts can login to the tablet ordering app.',
      });
    }

    if (!user.table_number) {
      return res.status(403).json({
        success: false,
        message:
          'This table account has no assigned table number.',
      });
    }

    let passwordMatches = false;

    const storedPassword =
      String(user.password || '');

    // =========================
    // ALLOW SEEDED TABLE ACCOUNTS
    // table1@dinesync.com to table8@dinesync.com
    // password: dinesync123
    // =========================

    if (
      tableNumberFromEmail &&
      password === TABLE_ACCOUNT_PASSWORD
    ) {
      passwordMatches = true;
    }

    // =========================
    // CHECK BCRYPT PASSWORD
    // =========================

    if (
      !passwordMatches &&
      (
        storedPassword.startsWith('$2y$') ||
        storedPassword.startsWith('$2a$') ||
        storedPassword.startsWith('$2b$')
      )
    ) {
      const normalizedHash =
        storedPassword.replace(
          /^\$2y\$/,
          '$2b$'
        );

      passwordMatches =
        await bcrypt.compare(
          password,
          normalizedHash
        );
    }

    // =========================
    // CHECK PLAIN TEXT PASSWORD
    // =========================

    if (!passwordMatches) {
      passwordMatches =
        password === storedPassword;
    }

    if (!passwordMatches) {
      console.log(
        'LOGIN PASSWORD DOES NOT MATCH'
      );

      return res.status(401).json({
        success: false,
        message:
          'Invalid email or password.',
      });
    }

    const {
      password: hiddenPassword,
      ...safeUser
    } = user;

    return res.json({
      success: true,
      message:
        'Login successful.',

      // table-token-1 means Table 1
      token:
        `table-token-${safeUser.table_number}`,

      user: safeUser,
    });
  } catch (error) {
    console.error(
      'LOGIN ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Login failed.',
      error:
        error.message ||
        String(error),
    });
  }
});

module.exports = router;