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
import usersRouter from "./users";
import settingsRouter from "./settings";
import interviewsRouter from "./interviews";
import foresightRouter from "./foresight";
import agentRouter from "./agent";
import documentsRouter from "./documents";
import osintSourcesRouter from "./osint-sources";
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
router.use(usersRouter);
router.use(settingsRouter);
router.use(interviewsRouter);
router.use(foresightRouter);
router.use(agentRouter);
router.use(documentsRouter);
router.use(osintSourcesRouter);

export default router;
