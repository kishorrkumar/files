require('dotenv').config();

const express = require('express');
const path = require('path');
const { initiateOutboundCall, getLeadWebhookConfig, buildLeadWebhookPayload } = require('./snapserve');
const { appendLead, getLeads } = require('./csv-storage');

const app = express();
const port = process.env.PORT || 3000;
const CSV_PATH = process.env.LEADS_CSV_PATH || path.join(__dirname, 'data', 'leads.csv');

app.use(express.json());

app.post('/submit-lead', async (req, res) => {

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
    const result = await appendLead(CSV_PATH, {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      course: course || null
    });

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

    try {
      const { webhookUrl } = getLeadWebhookConfig();
      if (webhookUrl) {
        const payload = buildLeadWebhookPayload({ name, email, phone, course, source: 'landing_page_form' });
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text().catch(() => '');
          console.error('Lead webhook failed:', webhookResponse.status, errorText);
        }
      }
    } catch (webhookErr) {
      console.error('Lead webhook submission failed:', webhookErr);
    }

    return res.status(200).json({ success: true, id: result.id, created_at: result.created_at });
  } catch (err) {
    console.error('submit-lead error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.get('/leads', async (req, res) => {
  try {
    const leads = await getLeads(CSV_PATH);
    return res.status(200).json(leads);
  } catch (err) {
    console.error('get-leads error:', err);
    return res.status(500).json({ error: 'Could not read leads.' });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/', (req, res) => {
  res.send('Render backend is running');
});

app.listen(port, () => {
  console.log(`Render backend listening on port ${port}`);
});
