import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, tenantsTable } from "@workspace/db";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { verifyPassword } from "../lib/password";
import { badRequest, unauthorized, notFound, serverError } from "../lib/errors";
import { recordAuditDirect, recordAudit } from "../lib/audit";

export const publicAuthRouter: IRouter = Router();
export const protectedAuthRouter: IRouter = Router();

publicAuthRouter.post("/v1/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      badRequest(res, "Email and password are required");
      return;
    }

    // Resolve tenant from email domain: admin@acme.com → acme.com → acme
    const emailDomain = email.split('@')[1];
    if (!emailDomain) {
      badRequest(res, "Invalid email address");
      return;
    }
    const domainSlug = emailDomain.split('.')[0]; // acme.com → acme

    const tenants = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, domainSlug))
      .limit(1);

    const tenant = tenants[0];
    if (!tenant) {
      unauthorized(res, "No organization found for this email domain. Contact your administrator.");
      return;
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.email, email), eq(usersTable.tenantId, tenant.id)))
      .limit(1);

    const user = users[0];
    if (!user) {
      unauthorized(res, "Invalid credentials");
      return;
    }

    const valid = await verifyPassword(password, user.hashedPassword);
    if (!valid) {
      unauthorized(res, "Invalid credentials");
      return;
    }

    const accessToken = generateAccessToken(user.id, user.tenantId, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id, user.tenantId, user.email, user.role);

    await recordAuditDirect(user.tenantId, user.id, "login", "user", user.id);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    serverError(res, "An unexpected error occurred");
  }
});

publicAuthRouter.post("/v1/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      badRequest(res, "Refresh token is required");
      return;
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      unauthorized(res, "Invalid or expired refresh token");
      return;
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, payload.sub), eq(usersTable.tenantId, payload.tenantId)))
      .limit(1);

    const user = users[0];
    if (!user) {
      notFound(res, "User not found");
      return;
    }

    const newAccessToken = generateAccessToken(user.id, user.tenantId, user.email, user.role);
    const newRefreshToken = generateRefreshToken(user.id, user.tenantId, user.email, user.role);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("Refresh error:", err);
    serverError(res, "An unexpected error occurred");
  }
});

protectedAuthRouter.get("/v1/auth/me", async (req, res) => {
  try {
    const result = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        tenantId: usersTable.tenantId,
        createdAt: usersTable.createdAt,
        tenantName: tenantsTable.name,
        tenantSlug: tenantsTable.slug,
      })
      .from(usersTable)
      .innerJoin(tenantsTable, eq(usersTable.tenantId, tenantsTable.id))
      .where(and(eq(usersTable.id, req.user!.id), eq(usersTable.tenantId, req.user!.tenantId)))
      .limit(1);

    const user = result[0];
    if (!user) {
      notFound(res, "User not found");
      return;
    }

    res.json(user);
  } catch (err) {
    console.error("Me error:", err);
    serverError(res, "An unexpected error occurred");
  }
});
