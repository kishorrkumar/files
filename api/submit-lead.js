// Vercel serverless proxy — forwards form submissions to the Render backend.
// Setup:
// 1. In Vercel project settings → Environment Variables, add:
//      RENDER_API_URL = https://<your-render-service>.onrender.com
// 2. Deploy. This file is auto-detected as /api/submit-lead.

require('dotenv').config();

const path = require('path');
const { appendLead } = require('../csv-storage');
const { initiateOutboundCall } = require('../snapserve');
const RENDER_API_URL = process.env.RENDER_API_URL;
const SNAP_SERVE_INTAKE_URL = process.env.SNAPSERVE_INTAKE_URL || process.env.snapserve_intake_url || '';
const CSV_PATH = process.env.LEADS_CSV_PATH || path.join(__dirname, '..', 'data', 'leads.csv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!RENDER_API_URL) {
    return res.status(500).json({ error: 'Render backend URL is not configured.' });
  }

  try {
    const backendUrl = `${RENDER_API_URL.replace(/\/$/, '')}/submit-lead`;
    const incomingPayload = req.body || {};
    const courseNames = {
      'UI/UX Design': 'UI/UX Design Mastery',
      'UI/UX Design Mastery': 'UI/UX Design Mastery',
      'Full-Stack Development': 'Full-Stack Web Development',
      'Full-Stack Web Development': 'Full-Stack Web Development',
      'Filmmaking & Video Editing': 'Filmmaking & Video Editing'
    };
    const normalizedCourse = courseNames[incomingPayload.course];

    if (!normalizedCourse) {
      return res.status(400).json({ error: 'Please select a valid academy course.' });
    }

    const backendPayload = { ...incomingPayload, course: normalizedCourse };
    const backendRes = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendPayload)
    });

    if (backendRes.ok) {
      try {
        await appendLead(CSV_PATH, {
          name: backendPayload.name || '',
          email: backendPayload.email || '',
          phone: backendPayload.phone || '',
          course: backendPayload.course || null,
          agent: backendPayload.agent || null
        });
      } catch (csvErr) {
        console.error('CSV fallback storage failed:', csvErr);
      }
    }

    if (backendRes.ok && backendPayload.phone && process.env.SNAPSERVE_AGENT_ID) {
      try {
        await initiateOutboundCall({
          phone: backendPayload.phone,
          agentId: process.env.SNAPSERVE_AGENT_ID,
          apiKey: process.env.SNAPSERVE_API_KEY
        });
      } catch (callErr) {
        console.error('Snapserve call initiation failed:', callErr);
      }
    }

    if (backendRes.ok && backendPayload.phone && SNAP_SERVE_INTAKE_URL) {
      try {
        await fetch(SNAP_SERVE_INTAKE_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(backendPayload)
        });
      } catch (hookErr) {
        console.error('Snapserve intake forwarding failed:', hookErr);
      }
    }

    const contentType = backendRes.headers.get('content-type') || '';
    const bodyText = await backendRes.text();

    res.status(backendRes.status);
    if (contentType.includes('application/json')) {
      return res.json(JSON.parse(bodyText || '{}'));
    }
    return res.send(bodyText);
  } catch (err) {
    console.error('submit-lead proxy error:', err);
    return res.status(500).json({ error: 'Could not forward request to backend.' });
  }
};
