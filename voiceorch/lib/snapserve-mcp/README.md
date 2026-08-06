# SnapServe MCP server

This stdio MCP server wraps the SnapServe API for the ThinkCreator Academy backend.

It exposes three tools:

- `snapserve_list_agents`
- `snapserve_list_calls`
- `snapserve_start_outbound_call`

The API key is read from `SNAPSERVE_API_KEY`; it is never stored in source control.

Example client configuration:

```json
{
  "mcpServers": {
    "snapserve": {
      "command": "node",
      "args": ["/absolute/path/to/files/voiceorch/lib/snapserve-mcp/dist/index.js"],
      "env": {
        "SNAPSERVE_API_KEY": "${SNAPSERVE_API_KEY}",
        "SNAPSERVE_BASE_URL": "https://app.snapserve.ai/api"
      }
    }
  }
}
```

For the deployed website, set `SNAPSERVE_MCP_ENABLED=true`. The Render backend becomes the MCP client and launches this server over stdio.
