import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { verifyPassword } from "../lib/password";
import { badRequest, unauthorized, notFound } from "../lib/errors";
import { recordAudit } from "../lib/audit";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/v1/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      badRequest(res, "Email and password are required");
      return;
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    const user = users[0];
    if (!user) {
      unauthorized(res, "Invalid email or password");
      return;
    }

    const valid = await verifyPassword(password, user.hashedPassword);
    if (!valid) {
      unauthorized(res, "Invalid email or password");
      return;
    }

    const accessToken = generateAccessToken(user.id, user.tenantId, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id, user.tenantId, user.email, user.role);

    await recordAudit(user.tenantId, user.id, "login", "user", user.id);

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
    res.status(500).json({ type: "https://riskmind.app/errors/internal", title: "Internal Server Error", status: 500 });
  }
});

router.post("/v1/auth/refresh", async (req, res) => {
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
      .where(eq(usersTable.id, payload.sub))
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
    res.status(500).json({ type: "https://riskmind.app/errors/internal", title: "Internal Server Error", status: 500 });
  }
});

router.get("/v1/auth/me", authMiddleware, async (req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        tenantId: usersTable.tenantId,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id))
      .limit(1);

    const user = users[0];
    if (!user) {
      notFound(res, "User not found");
      return;
    }

    res.json(user);
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ type: "https://riskmind.app/errors/internal", title: "Internal Server Error", status: 500 });
  }
});

export default router;
