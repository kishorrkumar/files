'use strict';

const path = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

let connectionPromise;

function serverPath() {
  const configured = process.env.SNAPSERVE_MCP_SERVER_PATH;
  if (!configured) {
    return path.join(__dirname, 'voiceorch', 'lib', 'snapserve-mcp', 'dist', 'index.js');
  }
  return path.isAbsolute(configured) ? configured : path.resolve(__dirname, configured);
}

async function connection() {
  if (connectionPromise) return connectionPromise;
  connectionPromise = (async () => {
    const client = new Client({ name: 'thinkcreator-site', version: '1.0.0' });
    const env = {
      NODE_ENV: process.env.NODE_ENV || 'production',
      SNAPSERVE_API_KEY: process.env.SNAPSERVE_API_KEY ||
        process.env.SNAPSERVE_API_TOKEN || process.env.SNAPSERVE_TOKEN || '',
      SNAPSERVE_BASE_URL: process.env.SNAPSERVE_BASE_URL ||
        process.env.SNAPSERVE_API_BASE_URL || process.env.SNAPSERVE_API_URL ||
        'https://app.snapserve.ai/api'
    };
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath()],
      env,
      stderr: 'inherit'
    });
    await client.connect(transport);
    return { client, transport };
  })().catch((error) => {
    connectionPromise = undefined;
    throw error;
  });
  return connectionPromise;
}

function parseResult(result) {
  if (result.isError) {
    const message = result.content?.find((item) => item.type === 'text')?.text || 'SnapServe MCP tool failed';
    throw new Error(message);
  }
  if (result.structuredContent && Object.hasOwn(result.structuredContent, 'data')) {
    return result.structuredContent.data;
  }
  const text = result.content?.find((item) => item.type === 'text')?.text;
  return text ? JSON.parse(text) : {};
}

async function callSnapServeTool(name, args = {}) {
  const { client } = await connection();
  return parseResult(await client.callTool({ name, arguments: args }));
}

async function closeSnapServeMcp() {
  if (!connectionPromise) return;
  try {
    const { client, transport } = await connectionPromise;
    await client.close();
    await transport.close().catch(() => {});
  } finally {
    connectionPromise = undefined;
  }
}

module.exports = { callSnapServeTool, closeSnapServeMcp, serverPath, parseResult };
