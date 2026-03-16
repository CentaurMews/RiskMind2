import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { publicAuthRouter, protectedAuthRouter } from "./auth";
import risksRouter from "./risks";
import vendorsRouter, { publicVendorRouter } from "./vendors";
import complianceRouter from "./compliance";
import signalsRouter from "./signals";
import findingsRouter from "./findings";
import alertsRouter from "./alerts";
import aiEnrichmentRouter from "./ai-enrichment";
import foresightRouter from "./foresight";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);

router.use(publicAuthRouter);

router.use(publicVendorRouter);

router.use(authMiddleware);

router.use(protectedAuthRouter);
router.use(risksRouter);
router.use(vendorsRouter);
router.use(complianceRouter);
router.use(signalsRouter);
router.use(findingsRouter);
router.use(alertsRouter);
router.use(aiEnrichmentRouter);
router.use(foresightRouter);

export default router;
