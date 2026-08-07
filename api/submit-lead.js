require('dotenv').config();

const path = require('path');
const { appendLead } = require('../lead-storage');
const { selectAgentForCourse } = require('../course-agent');
const { databaseUrl } = require('../database-config');

const RENDER_API_URL = process.env.RENDER_API_URL || '';
const SNAP_SERVE_INTAKE_URL = process.env.SNAPSERVE_INTAKE_URL || process.env.snapserve_intake_url || '';
const CSV_PATH = process.env.LEADS_CSV_PATH || path.join(__dirname, '..', 'data', 'leads.csv');

const COURSE_NAMES = {
  'UI/UX Design': 'UI/UX Design Mastery',
  'UI/UX Design Mastery': 'UI/UX Design Mastery',
  'Full-Stack Development': 'Full-Stack Web Development',
  'Full-Stack Web Development': 'Full-Stack Web Development',
  'Filmmaking & Video Editing': 'Filmmaking & Video Editing'
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const incoming = req.body || {};
  const course = COURSE_NAMES[incoming.course];
  const name = String(incoming.name || '').trim();
  const email = String(incoming.email || '').trim();
  const phone = String(incoming.phone || '').trim();

  if (name.length < 2) return res.status(400).json({ error: 'A valid name is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (phone.replace(/\D/g, '').length < 8) {
    return res.status(400).json({ error: 'A valid phone number is required.' });
  }
  if (!course) return res.status(400).json({ error: 'Please select a valid academy course.' });

  const payload = { ...incoming, name, email, phone, course };

  if (RENDER_API_URL) {
    try {
      const backendRes = await fetch(`${RENDER_API_URL.replace(/\/$/, '')}/submit-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const bodyText = await backendRes.text();
      if (backendRes.ok) {
        res.status(backendRes.status);
        const contentType = backendRes.headers.get('content-type') || '';
        return contentType.includes('application/json')
          ? res.json(JSON.parse(bodyText || '{}'))
          : res.send(bodyText);
      }
      console.error('Render lead submission failed:', backendRes.status, bodyText);
      const backendBody = (() => {
        try { return JSON.parse(bodyText || '{}'); } catch { return {}; }
      })();
      if (!databaseUrl()) {
        return res.status(backendRes.status).json({
          error: backendBody.error || 'The admissions service is temporarily unavailable. Please try again shortly.'
        });
      }
      console.warn('Using direct Neon lead storage after Render rejected the request.');
    } catch (error) {
      console.error('Render unavailable:', error.message);
      if (!databaseUrl()) {
        return res.status(503).json({
          error: 'The admissions service is temporarily unavailable. Please try again shortly.'
        });
      }
    }
  }

  if (!databaseUrl()) {
    console.error('Lead submission storage is not configured: set RENDER_API_URL or DATABASE_URL.');
    return res.status(503).json({
      error: 'The admissions service is temporarily unavailable. Please try again shortly.'
    });
  }

  try {
    const courseAgent = payload.agent ? null : await selectAgentForCourse(course);
    payload.agent = payload.agent || courseAgent?.id || null;
    const saved = await appendLead(CSV_PATH, payload);

    if (phone && SNAP_SERVE_INTAKE_URL) {
      fetch(SNAP_SERVE_INTAKE_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(error => console.error('Snapserve intake forwarding failed:', error.message));
    }

    return res.status(200).json({
      success: true,
      id: saved.id,
      created_at: saved.created_at,
      storage: 'database'
    });
  } catch (error) {
    console.error('Direct lead storage failed:', error);
    return res.status(503).json({
      error: 'The admissions service is temporarily unavailable. Please try again shortly.'
    });
  }
};
