import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { verifyAccessToken } from "../lib/jwt";
import { registerMcpTools } from "./tools";

interface AuthContext {
  tenantId: string;
  userId: string;
  role: string;
}

let currentAuth: AuthContext | null = null;

export function getMcpAuth(): AuthContext | null {
  return currentAuth;
}

const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

function createMcpServer(): McpServer {
  const mcp = new McpServer({
    name: "RiskMind",
    version: "0.3.0",
  });
  registerMcpTools(mcp);
  return mcp;
}

export async function handleMcpRequest(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    currentAuth = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = verifyAccessToken(token);
      if (payload) {
        currentAuth = {
          tenantId: payload.tenantId,
          userId: payload.sub,
          role: payload.role,
        };
      }
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    if (req.method === "DELETE") {
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.close();
        sessions.delete(sessionId);
      }
      res.status(200).end();
      return;
    }

    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });

    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    if (transport.sessionId) {
      sessions.set(transport.sessionId, { server, transport });
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
