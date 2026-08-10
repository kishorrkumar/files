require('dotenv').config();

const path = require('path');
const { appendLead } = require('../lead-storage');
const { selectAgentForCourse, isLeadEligibleForCall } = require('../course-agent');
const { syncLeadToSnapserve } = require('../snapserve');
const { databaseUrl } = require('../database-config');

const RENDER_API_URL = process.env.RENDER_API_URL || '';
const CSV_PATH = process.env.LEADS_CSV_PATH || path.join(__dirname, '..', 'data', 'leads.csv');

const COURSE_NAMES = {
  'UI/UX Design': 'UI/UX Design Mastery',
  'UI/UX Design Mastery': 'UI/UX Design Mastery',
  'Full-Stack Development': 'Full-Stack Web Development',
  'Full-Stack Web Development': 'Full-Stack Web Development',
  'Filmmaking & Video Editing': 'Filmmaking & Video Editing',
  'SnapServe Voice AI Hackathon': 'SnapServe Voice AI Hackathon'
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
  if (!course) return res.status(400).json({ error: 'Please select a valid campaign.' });
  if (course === 'SnapServe Voice AI Hackathon') {
    if (!incoming.interest) return res.status(400).json({ error: 'Please select your level of interest.' });
    if (!incoming.attendance && !incoming.attend) {
      return res.status(400).json({ error: 'Please select whether you can attend.' });
    }
  }

  const payload = {
    ...incoming,
    name,
    email,
    phone,
    course,
    interest: String(incoming.interest || '').trim() || null,
    attendance: String(incoming.attendance || incoming.attend || '').trim() || null,
    source: String(incoming.source || 'landing_page_form').trim()
  };

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
    const eligibleForCall = isLeadEligibleForCall(course, payload.interest);
    const courseAgent = payload.agent || !eligibleForCall ? null : await selectAgentForCourse(course);
    payload.agent = eligibleForCall ? (payload.agent || courseAgent?.id || null) : null;
    const saved = await appendLead(CSV_PATH, payload);
    let snapserveLeadSync = { skipped: true };
    try {
      snapserveLeadSync = await syncLeadToSnapserve(saved);
    } catch (syncError) {
      console.error('SnapServe lead mail sync failed:', syncError.message);
    }

    return res.status(200).json({
      success: true,
      id: saved.id,
      created_at: saved.created_at,
      storage: 'database',
      snapserve_synced: snapserveLeadSync.synced === true
    });
  } catch (error) {
    console.error('Direct lead storage failed:', error);
    return res.status(503).json({
      error: 'The admissions service is temporarily unavailable. Please try again shortly.'
    });
  }
};
