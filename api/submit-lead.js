// Vercel serverless function — POST /api/submit-lead
// Inserts a lead into the Neon `leads` table.
//
// Setup:
// 1. npm install @neondatabase/serverless
// 2. In Vercel project settings → Environment Variables, add:
//      DATABASE_URL = <your Neon connection string from Neon dashboard → Connect>
// 3. Deploy. This file is auto-detected as /api/submit-lead.

require('dotenv').config();

const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;

module.exports = async (req, res) => {
  // Basic CORS (safe to keep even on same-origin deploys)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, phone, course } = req.body || {};

    // Server-side validation — never trust the client
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'A valid name is required' });
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRe.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    const phoneDigits = (phone || '').replace(/[^0-9]/g, '');
    if (phoneDigits.length < 8) {
      return res.status(400).json({ error: 'A valid phone number is required' });
    }

    if (!DATABASE_URL) {
      return res.status(500).json({ error: 'Database configuration is missing.' });
    }

    const sql = neon(DATABASE_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        course TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const result = await sql`
      INSERT INTO leads (name, email, phone, course)
      VALUES (${name.trim()}, ${email.trim()}, ${phone.trim()}, ${course || null})
      RETURNING id, created_at
    `;

    return res.status(200).json({ success: true, id: result[0].id });
  } catch (err) {
    console.error('submit-lead error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
