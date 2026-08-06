const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { SnapServeApi } = require('../voiceorch/lib/snapserve-mcp/dist/snapserve-api');

test('SnapServe MCP server completes the stdio handshake and lists its tools', async () => {
  const client = new Client({ name: 'snapserve-mcp-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, '..', 'voiceorch', 'lib', 'snapserve-mcp', 'dist', 'index.js')],
    env: {
      ...process.env,
      SNAPSERVE_API_KEY: 'test-key',
      SNAPSERVE_BASE_URL: 'https://example.test/api'
    },
    stderr: 'pipe'
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map((tool) => tool.name).sort(),
      ['snapserve_list_agents', 'snapserve_list_calls', 'snapserve_start_outbound_call']
    );
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
});

test('SnapServe API wrapper sends authenticated outbound calls', async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: 99, status: 'queued' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const api = new SnapServeApi({ apiKey: 'secret-test-key', baseUrl: 'https://example.test/api/' });
    const result = await api.startOutboundCall({
      phone: '+918925109358',
      agentId: '7',
      webhookBaseUrl: 'https://backend.example.test'
    });

    assert.equal(result.id, 99);
    assert.equal(request.url, 'https://example.test/api/calls/outbound');
    assert.equal(request.options.headers.Authorization, 'Bearer secret-test-key');
    assert.deepEqual(JSON.parse(request.options.body), {
      agentId: 7,
      toNumber: '+918925109358',
      webhookBaseUrl: 'https://backend.example.test'
    });
  } finally {
    global.fetch = originalFetch;
  }
});
