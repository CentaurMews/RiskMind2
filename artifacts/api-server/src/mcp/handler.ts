import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { verifyAccessToken } from "../lib/jwt";
import { registerMcpTools } from "./tools";

export interface McpAuthContext {
  tenantId: string;
  userId: string;
  role: string;
}

interface McpSession {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  auth: McpAuthContext | null;
}

const sessions = new Map<string, McpSession>();

export function getMcpAuthBySessionId(sessionId: string | undefined): McpAuthContext | null {
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  return session?.auth ?? null;
}

function createMcpServer(): McpServer {
  const mcp = new McpServer({
    name: "RiskMind",
    version: "0.3.0",
  });
  registerMcpTools(mcp);
  return mcp;
}

function extractAuth(req: Request): McpAuthContext | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  return { tenantId: payload.tenantId, userId: payload.sub, role: payload.role };
}

export async function handleMcpRequest(req: Request, res: Response) {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (req.method === "DELETE") {
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.close();
        sessions.delete(sessionId);
      }
      res.status(200).end();
      return;
    }

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      const auth = extractAuth(req);
      if (auth) {
        session.auth = auth;
      }
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    const auth = extractAuth(req);
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });

    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    if (transport.sessionId) {
      sessions.set(transport.sessionId, { server, transport, auth });
    }
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        type: "https://riskmind.app/errors/internal-server-error",
        title: "Internal Server Error",
        status: 500,
        detail: "MCP request processing failed",
      });
    }
  }
}
