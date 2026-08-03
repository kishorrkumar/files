require('dotenv').config();

const SNAPSERVE_API_BASE_URL = process.env.SNAPSERVE_API_BASE_URL
  || process.env.SNAPSERVE_API_URL
  || process.env.snapserve_api_url
  || 'https://app.snapserve.ai/api';

function getSnapserveConfig() {
  return {
    apiKey: process.env.SNAPSERVE_API_KEY || process.env.SNAPSERVE_API_TOKEN || process.env.snapserve_api_token || '',
    agentId: process.env.SNAPSERVE_AGENT_ID || process.env.snapserve_agent_id || ''
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

function buildOutboundCallPayload(phone, agentId) {
  return {
    agentId,
    toNumber: normalizePhoneForSnapserve(phone)
  };
}

async function initiateOutboundCall({ phone, agentId, apiKey }) {
  const config = getSnapserveConfig();
  const resolvedApiKey = apiKey || config.apiKey;
  const resolvedAgentId = agentId || config.agentId;

  if (!resolvedApiKey) {
    throw new Error('SNAPSERVE_API_KEY is not configured');
  }

  const payload = buildOutboundCallPayload(phone, resolvedAgentId);

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
    throw new Error(data.message || 'Failed to initiate Snapserve call');
  }

  return data;
}

module.exports = {
  getSnapserveConfig,
  normalizePhoneForSnapserve,
  buildOutboundCallPayload,
  initiateOutboundCall
};
