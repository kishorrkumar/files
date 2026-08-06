require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('node:crypto');
const { initiateOutboundCall, getLeadWebhookConfig, buildLeadWebhookPayload, fetchSnapserveAgents } = require('./snapserve');
const { selectAgentForCourse, courseForAgentName } = require('./course-agent');
const { appendLead, getLeads, updateLeadAgent } = require('./lead-storage');
const { upsertCall, getCalls } = require('./call-storage');
const { callFromPayload, callsFromResponse } = require('./call-normalization');
const { callSnapServeTool, closeSnapServeMcp } = require('./snapserve-mcp-client');
const { getAutoCallEnabled, setAutoCallEnabled } = require('./settings-storage');

const app = express();
const port = process.env.PORT || 3000;
const CSV_PATH = process.env.LEADS_CSV_PATH || path.join(__dirname, 'data', 'leads.csv');
const CALLS_PATH = process.env.CALLS_CSV_PATH || path.join(__dirname, 'data', 'calls.csv');

app.use(express.json());

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function createAdminToken() {
  const expiresAt = Date.now() + (8 * 60 * 60 * 1000);
  const signature = crypto.createHmac('sha256', sessionSecret()).update(String(expiresAt)).digest('hex');
  return `${expiresAt}.${signature}`;
}

function validAdminToken(token) {
  const [expiresAt, signature] = String(token || '').split('.');
  if (!expiresAt || !signature || Number(expiresAt) < Date.now() || !sessionSecret()) return false;
  const expected = crypto.createHmac('sha256', sessionSecret()).update(expiresAt).digest('hex');
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function adminSessionFromRequest(req) {
  const cookies = Object.fromEntries(
    String(req.headers.cookie || '').split(';').filter(Boolean).map(part => {
      const index = part.indexOf('=');
      return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
    })
  );
  return validAdminToken(cookies.tca_admin_session);
}

function requireAdmin(req, res, next) {
  if (!adminSessionFromRequest(req)) return res.status(401).json({ error: 'Admin login required.' });
  next();
}

function requireAdminPage(req, res, next) {
  if (!adminSessionFromRequest(req)) return res.redirect('/admin/login');
  next();
}

function safePasswordMatch(received, expected) {
  const left = Buffer.from(String(received || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
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

  const callData = callFromPayload(body);

  try {
    const result = await upsertCall(CALLS_PATH, callData);
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
    const courseAgent = agent ? null : await selectAgentForCourse(normalizedCourse);
    const assignedAgentId = agent || courseAgent?.id || null;
    const result = await appendLead(CSV_PATH, {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      course: normalizedCourse,
      agent: assignedAgentId
    });

    try {
      const autoCallEnabled = await getAutoCallEnabled();
      const agentId = assignedAgentId || process.env.SNAPSERVE_AGENT_ID || '';
      if (autoCallEnabled && agentId) {
        const call = await initiateOutboundCall({
          phone,
          agentId,
          apiKey: process.env.SNAPSERVE_API_KEY
        });
        console.log('Automatic Snapserve call initiated:', call);
      }
    } catch (callErr) {
      console.error('Automatic Snapserve call initiation failed:', callErr);
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

app.get('/agents', requireAdmin, async (req, res) => {
  try {
    const agents = await fetchSnapserveAgents();
    return res.status(200).json(agents);
  } catch (err) {
    console.error('get-agents error:', err);
    return res.status(500).json({ error: 'Could not fetch agents.' });
  }
});

app.get('/leads', requireAdmin, async (req, res) => {
  try {
    const leads = await getLeads(CSV_PATH);
    const courseDefaults = new Map();
    for (const lead of leads) {
      if (lead.agent || !lead.course) continue;
      if (!courseDefaults.has(lead.course)) {
        courseDefaults.set(lead.course, await selectAgentForCourse(lead.course));
      }
      const courseAgent = courseDefaults.get(lead.course);
      if (courseAgent?.id) {
        await updateLeadAgent(CSV_PATH, lead.id, courseAgent.id);
        lead.agent = String(courseAgent.id);
      }
    }
    return res.status(200).json(leads);
  } catch (err) {
    console.error('get-leads error:', err);
    return res.status(500).json({ error: 'Could not read leads.' });
  }
});

app.patch('/leads/:id/agent', requireAdmin, async (req, res) => {
  const { agentId } = req.body || {};
  if (!agentId) return res.status(400).json({ error: 'Agent ID is required.' });
  try {
    const lead = await updateLeadAgent(CSV_PATH, req.params.id, agentId);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    return res.status(200).json({ success: true, lead });
  } catch (error) {
    console.error('update-lead-agent error:', error);
    return res.status(500).json({ error: 'Could not save the selected agent.' });
  }
});

app.get('/settings', requireAdmin, async (req, res) => {
  try {
    return res.status(200).json({ auto_call_enabled: await getAutoCallEnabled() });
  } catch (error) {
    return res.status(500).json({ error: 'Could not load settings.' });
  }
});

app.post('/settings/auto-call', requireAdmin, async (req, res) => {
  try {
    const enabled = await setAutoCallEnabled(req.body?.enabled === true);
    return res.status(200).json({ success: true, auto_call_enabled: enabled });
  } catch (error) {
    console.error('auto-call-setting error:', error);
    return res.status(500).json({ error: 'Could not save auto call setting.' });
  }
});

app.post('/call-lead', requireAdmin, async (req, res) => {
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

app.get('/calls', requireAdmin, async (req, res) => {
  try {
    let calls = await getCalls(CALLS_PATH);

    const apiKey = process.env.SNAPSERVE_API_KEY || process.env.SNAPSERVE_API_TOKEN || process.env.snapserve_api_token;
    if (apiKey) {
      try {
        let remotePayload;
        if (String(process.env.SNAPSERVE_MCP_ENABLED || '').toLowerCase() === 'true') {
          remotePayload = await callSnapServeTool('snapserve_list_calls', { limit: 500 });
        } else {
          const snapserveBaseUrl = process.env.SNAPSERVE_BASE_URL ||
            process.env.SNAPSERVE_API_BASE_URL || process.env.SNAPSERVE_API_URL ||
            'https://app.snapserve.ai/api';
          const response = await fetch(`${snapserveBaseUrl.replace(/\/$/, '')}/calls?limit=500`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            }
          });
          if (!response.ok) throw new Error(`SnapServe calls API returned ${response.status}`);
          remotePayload = await response.json();
        }
        {
          const snapserveCalls = callsFromResponse(remotePayload);
          for (const call of snapserveCalls) {
            await upsertCall(CALLS_PATH, callFromPayload(call));
          }
          calls = await getCalls(CALLS_PATH);
        }
      } catch (syncErr) {
        console.error('Failed to sync calls from Snapserve API:', syncErr);
      }
    }

    const leads = await getLeads(CSV_PATH);
    const leadByPhone = new Map(
      leads
        .filter((lead) => String(lead.phone || '').replace(/\D/g, '').slice(-10))
        .map((lead) => [String(lead.phone).replace(/\D/g, '').slice(-10), lead])
    );
    calls = calls.map((call) => {
      const phoneKey = String(call.phone || '').replace(/\D/g, '').slice(-10);
      const lead = leadByPhone.get(phoneKey);
      return {
        ...call,
        student_name: call.student_name || lead?.name || '',
        course: call.course || lead?.course || courseForAgentName(call.agent_name) || ''
      };
    });

    return res.status(200).json(calls);
  } catch (err) {
    console.error('get-calls error:', err);
    return res.status(500).json({ error: 'Could not read calls.' });
  }
});

app.get('/admin/login', (req, res) => {
  if (adminSessionFromRequest(req)) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.post('/admin/login', (req, res) => {
  const configuredPassword = process.env.ADMIN_PASSWORD || '';
  if (!configuredPassword || !sessionSecret()) {
    return res.status(503).json({ error: 'Admin login is not configured.' });
  }
  if (!safePasswordMatch(req.body?.password, configuredPassword)) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `tca_admin_session=${encodeURIComponent(createAdminToken())}; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict${secure}`
  );
  return res.status(200).json({ success: true });
});

app.post('/admin/logout', requireAdmin, (req, res) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `tca_admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${secure}`);
  return res.status(200).json({ success: true });
});

app.get('/admin', requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/', (req, res) => {
  res.send('Render backend is running');
});

app.listen(port, () => {
  console.log(`Render backend listening on port ${port}`);
});

async function shutdown() {
  await closeSnapServeMcp().catch(() => {});
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
