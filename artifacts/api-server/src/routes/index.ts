import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { publicAuthRouter, protectedAuthRouter } from "./auth";
import risksRouter from "./risks";
import vendorsRouter, { publicVendorRouter } from "./vendors";
import complianceRouter from "./compliance";
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

export default router;
