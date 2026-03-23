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
import searchRouter from "./search";
import assessmentTemplatesRouter from "./assessment-templates";
import assessmentsRouter from "./assessments";
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
router.use(searchRouter);
router.use(assessmentTemplatesRouter);
router.use(assessmentsRouter);

export default router;
