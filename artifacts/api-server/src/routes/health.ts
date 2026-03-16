import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { sendError } from "../lib/errors";

const router: IRouter = Router();

router.get("/v1/health", async (_req, res) => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    sendError(res, 503, "Service Unavailable", "Database connection failed");
  }
});

export default router;
