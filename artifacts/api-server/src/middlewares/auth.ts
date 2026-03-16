import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type JwtPayload } from "../lib/jwt";
import { unauthorized } from "../lib/errors";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        email: string;
        role: string;
      };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    unauthorized(res, "Missing or invalid Authorization header");
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) {
    unauthorized(res, "Invalid or expired token");
    return;
  }

  req.user = {
    id: payload.sub,
    tenantId: payload.tenantId,
    email: payload.email,
    role: payload.role,
  };

  next();
}
