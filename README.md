# SnapServe Voice AI Hackathon CRM

A Hackathon registration website plus a password-protected CRM for managing leads, assigning SnapServe voice agents, starting outbound calls, and reviewing call outcomes.

## What is included

- `index.html` — responsive SnapServe Hackathon landing page and lead form
- `/api/submit-lead` — Vercel-compatible lead submission endpoint
- `/admin/login` — protected CRM login
- `/admin` — leads, agent assignment, manual calls, auto-call setting, recordings, transcripts, and call metrics
- interested Hackathon leads default to the active SnapServe agent whose name contains `Liza`; other Hackathon leads cannot be assigned or called
- Neon PostgreSQL persistence for leads, settings, and call records
- SnapServe REST API or MCP integration

## Run locally

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000` for the website and `http://localhost:3000/admin` for the CRM.

## Required Render variables

```text
DATABASE_URL=your Neon pooled connection string
SNAPSERVE_API_KEY=your SnapServe API key
SNAPSERVE_BASE_URL=https://app.snapserve.ai/api
SNAPSERVE_LEAD_WEBHOOK_URL=your SnapServe lead webhook URL
RENDER_API_URL=https://your-render-service.onrender.com
WEBHOOK_BASE_URL=https://your-render-service.onrender.com
SNAPSERVE_WEBHOOK_SECRET=a long random secret
ADMIN_PASSWORD=a strong password
ADMIN_SESSION_SECRET=a different long random secret
```

Set `SNAPSERVE_MCP_ENABLED=true` only when the MCP server exists in the deployed repository. Otherwise leave it `false` and the backend will use the SnapServe REST API.

`SNAPSERVE_LEAD_WEBHOOK_URL` connects the submitted phone number, full name, and email address to the SnapServe lead before Liza calls. Configure Liza's mail option inside SnapServe to send the follow-up email after the conversation.

## Required Vercel variables

```text
RENDER_API_URL=https://your-render-service.onrender.com
DATABASE_URL=the same Neon pooled connection string
```

The Render service is the primary backend. The Vercel endpoint falls back to direct Neon storage when Render is unavailable.

## Deploy

1. Create or update the Render Web Service using `npm install` as the build command and `npm start` as the start command.
2. Add all Render variables above and redeploy.
3. Import this repository into Vercel and add the two Vercel variables.
4. Submit a test registration from the public website.
5. Open `/admin`, sign in, confirm the lead appears, select an agent, and press **Call lead**.
6. Configure the SnapServe webhook URL as `https://your-render-service.onrender.com/api/webhook/snapserve` and send the configured webhook secret.

The application creates and migrates its Neon tables automatically. `database.sql` is provided for manual provisioning if needed.

## Verify

```bash
npm test
```

Never commit real API keys, database URLs, or admin passwords.
