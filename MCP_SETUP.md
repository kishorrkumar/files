# SnapServe MCP and Neon setup

## Architecture

The browser sends requests to the Render backend. The Render backend is the MCP client. It launches the repository's SnapServe MCP server over stdio, and the MCP server calls the SnapServe API.

The browser must not receive the SnapServe API key and does not launch the MCP process directly.

## Render environment variables

Set these in the Render service:

```text
SNAPSERVE_API_KEY=your SnapServe key
SNAPSERVE_BASE_URL=https://app.snapserve.ai/api
SNAPSERVE_MCP_ENABLED=true
DATABASE_URL=your Neon pooled connection string
WEBHOOK_BASE_URL=https://your-render-service.onrender.com
SNAPSERVE_WEBHOOK_SECRET=a long random secret
ADMIN_PASSWORD=a strong admin password
ADMIN_SESSION_SECRET=a different long random secret
```

`SNAPSERVE_MCP_SERVER_PATH` is optional. The backend automatically uses:

```text
voiceorch/lib/snapserve-mcp/dist/index.js
```

## Vercel environment variables

Set these in the frontend project:

```text
RENDER_API_URL=https://your-render-service.onrender.com
DATABASE_URL=the same Neon pooled connection string
```

The Render backend is the preferred path. `DATABASE_URL` on Vercel provides a direct persistent fallback for lead submissions and webhook storage.

## Neon database

No manual table creation is required. The application creates these tables and indexes automatically when it connects:

- `leads`
- `app_settings`
- `call_records`
- `snapserve_webhooks`

For explicit provisioning, run `database.sql` once in the Neon SQL Editor. Do not place the Neon connection string or SnapServe key in GitHub.

## Local MCP verification

```bash
npm install
SNAPSERVE_API_KEY=your_key npm run mcp:start
```

For an external MCP-aware desktop client, use the absolute path to `voiceorch/lib/snapserve-mcp/dist/index.js` as shown in the SnapServe configuration.
