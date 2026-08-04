require('dotenv').config();

const path = require('path');
const { initiateOutboundCall } = require('../snapserve');
const { updateLeadAgent } = require('../csv-storage');

const RENDER_API_URL = process.env.RENDER_API_URL;
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

  const { leadId, agentId, phone } = req.body || {};

  if (!phone || !agentId) {
    return res.status(400).json({ error: 'Phone number and agent ID are required.' });
  }

  if (RENDER_API_URL) {
    try {
      const renderRes = await fetch(`${RENDER_API_URL.replace(/\/$/, '')}/call-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await renderRes.json().catch(() => ({}));
      return res.status(renderRes.status).json(data);
    } catch (err) {
      console.error('Proxy call-lead failed:', err);
    }
  }

  try {
    if (leadId) {
      await updateLeadAgent(CSV_PATH, leadId, agentId);
    }
    const call = await initiateOutboundCall({
      phone,
      agentId,
      apiKey: process.env.SNAPSERVE_API_KEY
    });
    return res.status(200).json({ success: true, call });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Call initiation failed' });
  }
};
