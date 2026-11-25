// A stateless MCP server (Streamable HTTP transport, JSON responses only) at /mcp.
// Each POST carries one JSON-RPC message; there are no sessions or server-sent events.

import { CONFIRM_WITHIN_DAYS, inputSchema, kinds, submit, validate } from "./submissions.js";

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

const INSTRUCTIONS =
  "Faster Loop is a free evening meetup series, hosted by Tuist, about what building software looks like when code is cheap. The first meetup is in Berlin in January 2027. Use these tools to propose a talk or offer to host a meetup on someone's behalf. Confirm the details with them before submitting. Each submission only counts once the person opens the confirmation link emailed to them.";

const tools = Object.entries(kinds).map(([kind, { tool, toolDescription }]) => ({
  kind,
  definition: { name: tool, description: toolDescription, inputSchema: inputSchema(kind) },
}));

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const result = (id, value) => json({ jsonrpc: "2.0", id, result: value });
const error = (id, code, message, status = 200) => json({ jsonrpc: "2.0", id, error: { code, message } }, status);

async function callTool(env, params, origin) {
  const tool = tools.find((t) => t.definition.name === params?.name);
  if (!tool) return null;
  const validation = validate(tool.kind, params.arguments ?? {});
  if (validation.errors) {
    return { content: [{ type: "text", text: validation.errors.join("\n") }], isError: true };
  }
  const outcome = await submit(env, tool.kind, validation.data, "mcp", origin);
  if (outcome.error) return { content: [{ type: "text", text: outcome.error }], isError: true };
  return {
    content: [
      {
        type: "text",
        text: `Submitted. We emailed a confirmation link to ${validation.data.email}. Tell the person to open it within ${CONFIRM_WITHIN_DAYS} days; the ${kinds[tool.kind].noun} only reaches the organizers once it's confirmed.`,
      },
    ],
  };
}

export async function handleMcp(request, env) {
  if (request.method !== "POST") {
    return new Response("This MCP server only accepts POST requests.", { status: 405, headers: { Allow: "POST" } });
  }

  let message;
  try {
    message = await request.json();
  } catch {
    return error(null, -32700, "Parse error", 400);
  }
  if (!message || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0") {
    return error(null, -32600, "Invalid request", 400);
  }

  // Notifications and responses from the client need no answer.
  if (message.id === undefined || message.method === undefined) {
    return new Response(null, { status: 202 });
  }

  const { id, method, params } = message;
  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(params?.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "fasterloop", title: "Faster Loop", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, { tools: tools.map((t) => t.definition) });
    case "tools/call": {
      const value = await callTool(env, params, new URL(request.url).origin);
      return value ? result(id, value) : error(id, -32602, `Unknown tool: ${params?.name}`);
    }
    default:
      return error(id, -32601, `Method not found: ${method}`);
  }
}
