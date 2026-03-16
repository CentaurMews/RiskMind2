import type { Request, Response, NextFunction } from "express";
import { forbidden } from "../lib/errors";

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      forbidden(res, "No authenticated user context");
      return;
    }

    if (!roles.includes(req.user.role)) {
      forbidden(res, `Role '${req.user.role}' does not have access to this resource. Required: ${roles.join(", ")}`);
      return;
    }

    next();
  };
}
