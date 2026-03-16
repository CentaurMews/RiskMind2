import { Router } from "express";
import { sendError } from "../lib/errors";

const router = Router();

const notImplemented = (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
  sendError(res as never, 501, "Not Implemented", "Foresight features are not yet available. Monte Carlo simulation and risk graph analysis are planned for a future release.");
};

router.get("/v1/foresight/simulations", notImplemented as never);
router.post("/v1/foresight/simulations", notImplemented as never);
router.get("/v1/foresight/simulations/:id", notImplemented as never);
router.get("/v1/foresight/risk-graph", notImplemented as never);
router.get("/v1/foresight/trust-circles", notImplemented as never);

export default router;
