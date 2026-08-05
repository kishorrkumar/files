require('dotenv').config();

const express = require('express');
const path = require('path');
const { initiateOutboundCall, getLeadWebhookConfig, buildLeadWebhookPayload, fetchSnapserveAgents } = require('./snapserve');
const { appendLead, getLeads, updateLeadAgent } = require('./lead-storage');
const { upsertCall, getCalls } = require('./call-storage');

const app = express();
const port = process.env.PORT || 3000;
const CSV_PATH = process.env.LEADS_CSV_PATH || path.join(__dirname, 'data', 'leads.csv');
const CALLS_PATH = process.env.CALLS_CSV_PATH || path.join(__dirname, 'data', 'calls.csv');

app.use(express.json());

function normalizeTranscript(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') return item;
      return `${item.role || item.speaker || 'speaker'}: ${item.text || item.content || item.message || ''}`;
    }).join('\n');
  }
  return JSON.stringify(value, null, 2);
}

const handleSnapserveWebhook = async (req, res) => {
  const webhookSecret = process.env.SNAPSERVE_WEBHOOK_SECRET || process.env.snapserve_webhook_secret || '';
  const receivedSecret =
    req.headers['x-snapserve-webhook-secret'] ||
    req.headers['x-snapserve-signature'] ||
    req.body?.secret ||
    '';

  if (webhookSecret && receivedSecret !== webhookSecret) {
    console.error('Snapserve webhook secret mismatch');
    return res.status(401).json({ error: 'Unauthorized webhook' });
  }

  const body = req.body || {};
  console.log('Received Snapserve webhook:', JSON.stringify(body));

  const snapserve_call_id = body.callId || body.id || body.call?.id || body.payload?.callId || '';
  const agent_id = body.agent_id || body.agentId || body.agent?.id || body.call?.agentId || '';
  const agent_name = body.agent_name || body.agentName || body.agent?.name || body.call?.agentName || '';
  const phone = body.phone || body.toNumber || body.fromNumber || body.call?.toNumber || body.call?.phone || body.payload?.phone || '';
  const duration = Number(body.durationSeconds || body.duration || body.callDuration || body.call?.durationSeconds || body.call?.duration || 0);
  const summary = body.callSummary || body.call_summary || body.summary || body.call?.summary || body.analysis?.summary || '';
  const success_evaluation = body.successEvaluation || body.success_evaluation || body.call?.successEvaluation || body.analysis?.successEvaluation || '';
  const recording_url = body.recordingUrl || body.recording_url || body.call?.recordingUrl || body.payload?.recordingUrl || '';
  const transcript = normalizeTranscript(
    body.transcript || body.call_transcript || body.callTranscript ||
    body.call?.transcript || body.analysis?.transcript || body.messages
  );
  const status = body.status || body.call_status || body.callStatus || body.event || body.type || 'completed';

  try {
    const result = await upsertCall(CALLS_PATH, {
      snapserve_call_id,
      agent_id,
      agent_name,
      phone,
      duration,
      summary,
      success_evaluation,
      recording_url,
      transcript,
      status
    });
    console.log('Saved call record to CSV:', result);
    return res.status(200).json({ success: true, id: result.id, created_at: result.created_at });
  } catch (err) {
    console.error('Error saving call record:', err);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
};

app.post('/webhook/snapserve', handleSnapserveWebhook);
app.post('/webhook', handleSnapserveWebhook);
app.post('/api/webhook/snapserve', handleSnapserveWebhook);

app.post('/submit-lead', async (req, res) => {

  const { name, email, phone, course, agent } = req.body || {};
  const courseNames = {
    'UI/UX Design': 'UI/UX Design Mastery',
    'UI/UX Design Mastery': 'UI/UX Design Mastery',
    'Full-Stack Development': 'Full-Stack Web Development',
    'Full-Stack Web Development': 'Full-Stack Web Development',
    'Filmmaking & Video Editing': 'Filmmaking & Video Editing'
  };
  const normalizedCourse = courseNames[course];

  if (!normalizedCourse) {
    return res.status(400).json({ error: 'Please select a valid academy course' });
  }

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
      course: normalizedCourse,
      agent: agent || null
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
        const payload = buildLeadWebhookPayload({ name, email, phone, course: normalizedCourse, source: 'landing_page_form' });
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

app.get('/agents', async (req, res) => {
  try {
    const agents = await fetchSnapserveAgents();
    return res.status(200).json(agents);
  } catch (err) {
    console.error('get-agents error:', err);
    return res.status(500).json({ error: 'Could not fetch agents.' });
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

app.post('/call-lead', async (req, res) => {
  const { leadId, agentId, phone } = req.body || {};

  if (!phone || !agentId) {
    return res.status(400).json({ error: 'Phone number and agent ID are required.' });
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
    console.log(`Admin initiated call for lead #${leadId || 'N/A'} with agent ${agentId}:`, call);

    return res.status(200).json({ success: true, call });
  } catch (err) {
    console.error('Admin call initiation failed:', err);
    return res.status(500).json({ error: err.message || 'Could not initiate call' });
  }
});

app.get('/calls', async (req, res) => {
  try {
    let calls = await getCalls(CALLS_PATH);

    const apiKey = process.env.SNAPSERVE_API_KEY || process.env.SNAPSERVE_API_TOKEN || process.env.snapserve_api_token;
    if (apiKey) {
      try {
        const response = await fetch('https://app.snapserve.ai/api/calls?limit=100', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const snapserveCalls = await response.json();
          if (Array.isArray(snapserveCalls)) {
            for (const call of snapserveCalls) {
              let recordingUrl = call.recordingUrl || '';
              if (recordingUrl && recordingUrl.startsWith('/')) {
                recordingUrl = `https://app.snapserve.ai${recordingUrl}`;
              }

              await upsertCall(CALLS_PATH, {
                snapserve_call_id: String(call.id || call.callId || ''),
                agent_id: String(call.agentId || ''),
                agent_name: call.agentName || '',
                phone: call.toNumber || call.phone || '',
                duration: call.durationSeconds || call.duration || 0,
                summary: call.callSummary || call.summary || '',
                success_evaluation: call.successEvaluation || '',
                recording_url: recordingUrl,
                transcript: normalizeTranscript(call.transcript || call.messages),
                status: call.status || 'unknown',
                created_at: call.createdAt || new Date().toISOString()
              });
            }

            calls = await getCalls(CALLS_PATH);
          }
        }
      } catch (syncErr) {
        console.error('Failed to sync calls from Snapserve API:', syncErr);
      }
    }

    return res.status(200).json(calls);
  } catch (err) {
    console.error('get-calls error:', err);
    return res.status(500).json({ error: 'Could not read calls.' });
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
