require('dotenv').config();

const SNAPSERVE_API_BASE_URL = process.env.SNAPSERVE_API_BASE_URL
  || process.env.SNAPSERVE_BASE_URL
  || process.env.SNAPSERVE_API_URL
  || process.env.snapserve_api_url
  || 'https://app.snapserve.ai/api';

function mcpEnabled() {
  return String(process.env.SNAPSERVE_MCP_ENABLED || '').toLowerCase() === 'true';
}

async function callMcpTool(name, args) {
  const { callSnapServeTool } = require('./snapserve-mcp-client');
  return callSnapServeTool(name, args);
}

function getSnapserveConfig() {
  return {
    apiKey: process.env.SNAPSERVE_API_KEY || process.env.SNAPSERVE_API_TOKEN || process.env.snapserve_api_token || '',
    agentId: process.env.SNAPSERVE_AGENT_ID || process.env.snapserve_agent_id || ''
  };
}

function getLeadWebhookConfig() {
  return {
    webhookUrl: process.env.WEBHOOK_URL || process.env.Web_book_URL || process.env.webhook_url || ''
  };
}

function buildLeadWebhookPayload(lead) {
  return {
    name: lead?.name || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    course: lead?.course || null,
    interest: lead?.interest || null,
    attendance: lead?.attendance || lead?.attend || null,
    source: lead?.source || 'landing_page_form'
  };
}

function normalizePhoneForSnapserve(phone) {
  if (typeof phone !== 'string') {
    return null;
  }

  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith('0') && digits.length > 10) {
    return `+${digits.slice(1)}`;
  }

  if (digits.length >= 10) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

function buildOutboundCallPayload(phone, agentId, webhookBaseUrl) {
  const parsedAgentId = !isNaN(Number(agentId)) && agentId !== '' ? Number(agentId) : agentId;
  const payload = {
    agentId: parsedAgentId,
    toNumber: normalizePhoneForSnapserve(phone)
  };

  if (webhookBaseUrl) {
    payload.webhookBaseUrl = webhookBaseUrl;
  }

  return payload;
}

async function initiateOutboundCall({ phone, agentId, apiKey, webhookBaseUrl }) {
  const config = getSnapserveConfig();
  const resolvedApiKey = apiKey || config.apiKey;
  const resolvedAgentId = agentId || config.agentId;
  const resolvedWebhookBaseUrl = webhookBaseUrl || process.env.WEBHOOK_BASE_URL || process.env.RENDER_API_URL || '';

  if (!resolvedApiKey) {
    throw new Error('SNAPSERVE_API_KEY is not configured');
  }
  if (resolvedAgentId === '' || resolvedAgentId == null) {
    throw new Error('A valid SnapServe agent ID is required');
  }
  if (!normalizePhoneForSnapserve(phone)) {
    throw new Error('A valid destination phone number is required');
  }

  if (mcpEnabled()) {
    return callMcpTool('snapserve_start_outbound_call', {
      phone: normalizePhoneForSnapserve(phone),
      agentId: resolvedAgentId,
      ...(resolvedWebhookBaseUrl ? { webhookBaseUrl: resolvedWebhookBaseUrl } : {})
    });
  }

  const payload = buildOutboundCallPayload(phone, resolvedAgentId, resolvedWebhookBaseUrl);
  console.log('[Snapserve Outbound Payload]', JSON.stringify(payload));

  const response = await fetch(`${SNAPSERVE_API_BASE_URL.replace(/\/$/, '')}/calls/outbound`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolvedApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data.message || data.error || (typeof data === 'object' && Object.keys(data).length ? JSON.stringify(data) : '') || `HTTP ${response.status}`;
    console.error('[Snapserve Call Error]', response.status, data);
    throw new Error(`Snapserve API error (${response.status}): ${detail}`);
  }

  const status = String(data.status || '').toLowerCase();
  if (data.errorMessage || ['failed', 'error', 'rejected', 'cancelled'].includes(status)) {
    const detail = data.errorMessage || data.recordingError || `Call status: ${status}`;
    throw new Error(`Snapserve telephony error: ${detail}`);
  }

  return {
    ...data,
    queued: status === 'pending' || status === 'queued',
    message: status === 'pending' || status === 'queued'
      ? 'Call accepted by SnapServe and waiting for the telephony provider.'
      : 'Call started successfully.'
  };
}

async function fetchSnapserveAgents() {
  const config = getSnapserveConfig();
  const { apiKey } = config;

  if (!apiKey) {
    console.warn('[Snapserve] No API key configured');
    return [];
  }

  if (mcpEnabled()) {
    const result = await callMcpTool('snapserve_list_agents');
    if (Array.isArray(result)) return result;
    return result.agents || result.data || [];
  }

  try {
    console.log('[Snapserve] Fetching agents from API...');
    const response = await fetch(`${SNAPSERVE_API_BASE_URL.replace(/\/$/, '')}/agents`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('[Snapserve] Failed with status:', response.status);
      return [];
    }

    const agents = await response.json();
    console.log('[Snapserve] Got agents:', Array.isArray(agents) ? agents.length + ' agents' : 'invalid format');
    return Array.isArray(agents) ? agents : [];
  } catch (err) {
    console.error('[Snapserve] Error:', err.message);
    return [];
  }
}

module.exports = {
  getSnapserveConfig,
  getLeadWebhookConfig,
  buildLeadWebhookPayload,
  normalizePhoneForSnapserve,
  buildOutboundCallPayload,
  initiateOutboundCall,
  fetchSnapserveAgents
};
