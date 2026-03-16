import { Router, type Request, type Response } from "express";
import { sendError } from "../lib/errors";

const router = Router();

function notImplemented(_req: Request, res: Response) {
  sendError(res, 501, "Not Implemented", "Foresight features are not yet available. Monte Carlo simulation and risk graph analysis are planned for a future release.");
}

router.get("/v1/foresight/simulations", notImplemented);
router.post("/v1/foresight/simulations", notImplemented);
router.get("/v1/foresight/simulations/:id", notImplemented);
router.get("/v1/foresight/risk-graph", notImplemented);
router.get("/v1/foresight/trust-circles", notImplemented);
router.all("/v1/foresight/{*path}", notImplemented);

export default router;
