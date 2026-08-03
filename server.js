require('dotenv').config();

const express = require('express');
const path = require('path');
const { neon } = require('@neondatabase/serverless');
const { initiateOutboundCall } = require('./snapserve');

const app = express();
const port = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

app.use(express.json());

app.post('/submit-lead', async (req, res) => {
  if (!DATABASE_URL) {
    return res.status(500).json({ error: 'Database configuration is missing.' });
  }

  const { name, email, phone, course } = req.body || {};

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

  try {
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

    try {
      const agentId = process.env.SNAPSERVE_AGENT_ID || '';
      if (agentId) {
        const call = await initiateOutboundCall({
          phone,
          agentId,
          apiKey: process.env.SNAPSERVE_API_KEY
        });
        console.log('Snapserve call initiated:', call);
      }
    } catch (callErr) {
      console.error('Snapserve call initiation failed:', callErr);
    }

    return res.status(200).json({ success: true, id: result[0].id });
  } catch (err) {
    console.error('submit-lead error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.get('/', (req, res) => {
  res.send('Render backend is running');
});

app.listen(port, () => {
  console.log(`Render backend listening on port ${port}`);
});
