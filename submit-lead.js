// Vercel serverless function — POST /api/submit-lead
// Stores each lead in a CSV file so it can be fetched later.
require('dotenv').config();

const path = require('path');
const { appendLead } = require('./csv-storage');

const CSV_PATH = process.env.LEADS_CSV_PATH || path.join(__dirname, 'data', 'leads.csv');

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

    const result = await appendLead(CSV_PATH, {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      course: course || null
    });

    return res.status(200).json({ success: true, id: result.id, created_at: result.created_at });
  } catch (err) {
    console.error('submit-lead error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
