import type { Response } from "express";

interface RFC7807Error {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

export function sendError(res: Response, status: number, title: string, detail?: string) {
  const error: RFC7807Error = {
    type: `https://riskmind.app/errors/${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    status,
    detail,
  };
  res.status(status).json(error);
}

export function badRequest(res: Response, detail?: string) {
  sendError(res, 400, "Bad Request", detail);
}

export function unauthorized(res: Response, detail?: string) {
  sendError(res, 401, "Unauthorized", detail || "Authentication required");
}

export function forbidden(res: Response, detail?: string) {
  sendError(res, 403, "Forbidden", detail || "Insufficient permissions");
}

export function notFound(res: Response, detail?: string) {
  sendError(res, 404, "Not Found", detail || "Resource not found");
}

export function conflict(res: Response, detail?: string) {
  sendError(res, 409, "Conflict", detail);
}

export function serverError(res: Response, detail?: string) {
  sendError(res, 500, "Internal Server Error", detail);
}
